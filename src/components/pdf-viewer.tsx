import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Download, Loader2, X } from "lucide-react"
import {
  VerifyKitProvider,
  Viewer,
  defaultLayoutPlugin,
  type DefaultLayoutPluginOptions,
  type LoadError,
  type ToolbarConfig,
  type ToolbarSlots,
  type VerifyKitConfig,
  type ViewerHandle,
  useVerification
} from "@trexolab/verifykit-react"
import { revocationPlugin } from "@trexolab/verifykit-plugin-revocation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractBase64Data } from "@/utils/base64"
import { decodeBase64ToBytes } from "@/utils/base64-async"
import { isBase64 } from "@/utils/file-reader"

const DEFAULT_REVOCATION_ENDPOINT = "https://verifykit.trexolab.com/api/revocation"

export interface PdfViewerOptions {
  provider?: Partial<VerifyKitConfig>
  layout?: DefaultLayoutPluginOptions
  signaturePanelOpen?: boolean
  revocation?: {
    enabled?: boolean
    endpoint?: string
    timeout?: number
    crl?: boolean
    ocsp?: boolean
    maxCrlSize?: number
    headers?: Record<string, string>
  }
}

interface PdfViewerProps {
  data: string
  title?: string
  className?: string
  onDownload?: () => void
  onClose?: () => void
  onOpenFile?: (file: File) => void
  viewerOptions?: PdfViewerOptions
  /** Drop the rounded border so the viewer can sit flush inside a workbench panel. */
  bare?: boolean
}

type ToolbarTransform = (slots: ToolbarSlots) => ToolbarSlots

const VERIFYKIT_PUBLIC_ASSET_BASE = import.meta.env.BASE_URL

function verifyKitAssetUrl(path: string) {
  return `${VERIFYKIT_PUBLIC_ASSET_BASE}${path}`
}

export function PdfViewer(props: PdfViewerProps) {
  const config = useMemo(() => buildVerifyKitConfig(props.viewerOptions), [props.viewerOptions])

  return (
    <VerifyKitProvider config={config}>
      <PdfViewerContent {...props} />
    </VerifyKitProvider>
  )
}

function PdfViewerContent({
  data,
  title,
  className,
  onDownload,
  onClose,
  onOpenFile,
  viewerOptions,
  bare,
}: PdfViewerProps) {
  const verification = useVerification()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(true)
  const viewerRef = useRef<ViewerHandle | null>(null)

  /**
   * The decoded bytes, shown before verification has run. The WASM verifier is synchronous and
   * holds the main thread for seconds on a large file, so waiting for it to finish before
   * handing anything to the Viewer left the user staring at a spinner the whole time.
   */
  const [previewBuffer, setPreviewBuffer] = useState<ArrayBuffer | null>(null)
  /**
   * The exact buffer handed to `load()`. Lets "the SDK kept our bytes" be told from "the
   * appearance swap produced new bytes" by reference, instead of comparing megabytes.
   */
  const verifiedInputRef = useRef<ArrayBuffer | null>(null)
  /** The viewer's own DOM, watched to tell when a page has actually been rasterized. */
  const containerRef = useRef<HTMLDivElement | null>(null)
  const toolbarVisibility = viewerOptions?.provider?.toolbar

  // Built once per mount, as the SDK requires: "always construct it inside useState — building
  // a plugin in the render body produces a new instance every render". A `useMemo` keyed on the
  // callback props looked equivalent but hands the Viewer a fresh plugin whenever a caller
  // passes an inline `onDownload`/`onOpenFile`. Callers that need different options remount
  // instead (see `key={viewerRenderKey}` in routes/pdf-verification.tsx).
  const [layout] = useState(() =>
    defaultLayoutPlugin({
      ...viewerOptions?.layout,
      toolbar: {
        ...viewerOptions?.layout?.toolbar,
        transform: composeToolbarTransform(
          viewerOptions?.layout?.toolbar?.transform,
          toolbarVisibility
        ),
      },
      disable: {
        openFile: !onOpenFile,
        download: Boolean(onDownload),
        ...viewerOptions?.layout?.disable,
      },
    })
  )

  // `load` is rebuilt once the WASM verifier finishes booting, so keying this
  // effect on it would verify the same document twice. Since SDK 0.6.0 `load()`
  // waits for WASM by itself, leaving the input as the only trigger needed.
  const verificationRef = useRef(verification)
  verificationRef.current = verification

  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      const { load, reset } = verificationRef.current
      reset()
      setLoadError(null)
      setPreviewBuffer(null)
      verifiedInputRef.current = null
      setIsPreparing(true)

      const trimmed = data.trim()
      if (!trimmed) {
        setLoadError("No PDF data provided.")
        setIsPreparing(false)
        return
      }

      try {
        const input = await resolvePdfInput(trimmed)
        if (cancelled) return

        // Show the document first, verify second. Only the byte path can do this — a URL or
        // blob input has nothing to display until the SDK has fetched it.
        if (input instanceof ArrayBuffer) {
          // pdf.js transfers the buffer it is handed to its own worker, which detaches it.
          // Give it a copy so the verifier below is not passed a zero-length buffer.
          setPreviewBuffer(input.slice(0))
          setIsPreparing(false)
          verifiedInputRef.current = input

          // Verification blocks the main thread, so React and pdf.js would never get the
          // frames they need. Let a page actually reach the screen before starting it.
          await waitForFirstPage(containerRef)
          if (cancelled) return
        }

        await load(input, toPdfFileName(title))
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : "Failed to load PDF.")
      } finally {
        if (!cancelled) {
          setIsPreparing(false)
        }
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
    }
  }, [data, title])

  useEffect(() => {
    const store = viewerRef.current?.getStore()
    if (!store || viewerOptions?.signaturePanelOpen === undefined) {
      return
    }

    store.update({ sigPanelOpen: viewerOptions.signaturePanelOpen })
  }, [verification.signatures, viewerOptions?.signaturePanelOpen])

  const errorMessage = loadError ?? formatLoadError(verification.error)
  // Keep showing the preview bytes unless the appearance swap actually replaced them — the SDK
  // hands `fileBuffer` straight back when no swap is needed, so comparing by reference avoids
  // re-rendering the whole document for an identical buffer.
  const displayBuffer =
    verification.fileBuffer && verification.fileBuffer !== verifiedInputRef.current
      ? verification.fileBuffer
      : (previewBuffer ?? verification.fileBuffer)
  // `loadError` means the document cannot be displayed, so the error panel has to win even
  // though a buffer exists. `verification.error` is deliberately not part of this: a signature
  // that fails to verify is still a PDF the user should be able to read.
  const isReady = Boolean(displayBuffer) && !loadError
  const isLoading = isPreparing || verification.isLoading

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 overflow-hidden bg-background",
        bare ? "border-0" : "rounded-lg border",
        className
      )}
    >
      {(onDownload || onClose) && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {onDownload && (
            <Button
              variant="secondary"
              size="sm"
              className="shadow-sm"
              onClick={onDownload}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download
            </Button>
          )}
          {onClose && (
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 shadow-sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {isReady ? (
        <div ref={containerRef} className="relative flex-1 min-h-0">
          <Viewer
            ref={viewerRef}
            fileBuffer={displayBuffer}
            fileName={verification.fileName || toPdfFileName(title)}
            plugins={[layout.plugin]}
            signatures={verification.signatures}
            unsignedFields={verification.unsignedFields}
            verificationStatus={verification.status ?? undefined}
            verifying={verification.isLoading}
            signaturePanelOpen={viewerOptions?.signaturePanelOpen ?? false}
            onOpenFile={onOpenFile}
            // Without this the Viewer's own failures are silent: `fileBuffer` is set, so the
            // component below renders, and a PDF that pdf.js cannot display leaves an empty
            // frame with no explanation. Surfacing it turns a blank panel into a real message.
            onLoadError={(error) =>
              setLoadError(formatLoadError(error) ?? "This PDF could not be displayed.")
            }
          />
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center bg-muted/20">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading PDF...</span>
          </div>
        </div>
      ) : errorMessage ? (
        <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">PDF preview unavailable.</p>
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
          <div className="flex max-w-md flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <p>PDF preview unavailable.</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Resolves once a page has actually been rasterized into the viewer.
 *
 * The Viewer's `onDocumentLoaded` is not the right signal — it fires when pdf.js has *parsed*
 * the file, roughly 400ms in, while the first canvas is still several hundred milliseconds
 * away. Starting the blocking verifier there froze the main thread before anything reached the
 * screen, which is the whole problem this is meant to avoid. A painted canvas is the only
 * signal that matches what the user can see.
 *
 * The cap matters: verification must never be held hostage by a page that never rasterizes.
 * Missing the paint costs a stutter; never verifying would cost the entire feature.
 */
function waitForFirstPage(ref: { current: HTMLElement | null }, timeoutMs = 5000) {
  return new Promise<void>((resolve) => {
    const start = performance.now()

    const tick = () => {
      // The ref, not a snapshot of it: this starts one tick before React has committed the
      // render that creates the container, so reading `.current` once would always see null.
      const canvas = ref.current?.querySelector("canvas")
      const painted = canvas instanceof HTMLCanvasElement && canvas.width > 0
      if (painted || performance.now() - start > timeoutMs) {
        // One more frame so the canvas is composited, not merely present in the DOM.
        requestAnimationFrame(() => resolve())
        return
      }
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

const HAS_WHITESPACE = /\s/

/**
 * Prefer handing this component a blob or object URL. It short-circuits here, which skips a
 * decode the caller has usually already paid for — on a 10 MB PDF that is ~14 M characters of
 * Base64 walked twice for no reason.
 */
async function resolvePdfInput(data: string): Promise<ArrayBuffer | string> {
  if (/^blob:/i.test(data) || isUrlLike(data)) {
    return data
  }

  const { data: rawBase64, mimeType } = extractBase64Data(data)
  // Unconditional `.replace()` copies the whole payload even when there is nothing to strip.
  const normalized = HAS_WHITESPACE.test(rawBase64) ? rawBase64.replace(/\s+/g, "") : rawBase64

  if (mimeType && mimeType !== "application/pdf") {
    throw new Error(`Expected application/pdf but received ${mimeType}.`)
  }

  if (!normalized || !isBase64(normalized)) {
    throw new Error("Unsupported PDF input. Pass a PDF data URI, raw base64, blob URL, or URL.")
  }

  return (await decodeBase64ToBytes(normalized)).buffer
}

function isUrlLike(value: string) {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("/")
}

function toPdfFileName(title?: string) {
  if (!title) return "document.pdf"
  return title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`
}

// `useVerification().error` is a plain LoadError ({ name, message }), not an Error
// instance, so it has to be read field-by-field rather than stringified.
function formatLoadError(error: LoadError | null) {
  if (!error) return null
  return error.message.trim() || `PDF could not be verified (${error.name}).`
}

function buildVerifyKitConfig(options?: PdfViewerOptions): VerifyKitConfig {
  const theme = {
    mode: "system" as const,
    ...options?.provider?.theme,
    overrides: {
      ...options?.provider?.theme?.overrides,
    },
  }

  const revocationOptions = options?.revocation
  const plugins =
    revocationOptions?.enabled === false
      ? []
      : [
          revocationPlugin({
            endpoint: revocationOptions?.endpoint ?? DEFAULT_REVOCATION_ENDPOINT,
            timeout: revocationOptions?.timeout,
            crl: revocationOptions?.crl,
            ocsp: revocationOptions?.ocsp,
            maxCrlSize: revocationOptions?.maxCrlSize,
            headers: revocationOptions?.headers,
          }),
        ]

  return {
    workerUrl: verifyKitAssetUrl("pdf.worker.min.mjs"),
    cMapUrl: verifyKitAssetUrl("cmaps/"),
    standardFontDataUrl: verifyKitAssetUrl("standard_fonts/"),
    ...options?.provider,
    theme,
    plugins,
  }
}

function composeToolbarTransform(
  baseTransform: ToolbarTransform | undefined,
  toolbarVisibility?: ToolbarConfig
) {
  return (slots: ToolbarSlots) => {
    const transformed = baseTransform ? baseTransform(slots) : slots
    return applyToolbarVisibility(transformed, toolbarVisibility)
  }
}

function applyToolbarVisibility(
  slots: ToolbarSlots,
  toolbarVisibility?: ToolbarConfig
): ToolbarSlots {
  if (!toolbarVisibility) {
    return slots
  }

  const nextSlots = { ...slots }

  if (toolbarVisibility.search === false) {
    delete nextSlots.SearchPopover
  }

  if (toolbarVisibility.pageNavigation === false) {
    delete nextSlots.GoToPreviousPage
    delete nextSlots.CurrentPageInput
    delete nextSlots.NumberOfPages
    delete nextSlots.GoToNextPage
  }

  if (toolbarVisibility.zoom === false) {
    delete nextSlots.ZoomOut
    delete nextSlots.Zoom
    delete nextSlots.ZoomIn
  }

  if (toolbarVisibility.rotation === false) {
    delete nextSlots.Rotate
  }

  if (toolbarVisibility.cursorTool === false) {
    delete nextSlots.CursorTool
  }

  if (toolbarVisibility.openFile === false) {
    delete nextSlots.OpenFile
  }

  if (toolbarVisibility.download === false) {
    delete nextSlots.Download
  }

  if (toolbarVisibility.print === false) {
    delete nextSlots.Print
  }

  if (toolbarVisibility.themeToggle === false) {
    delete nextSlots.ThemeToggle
  }

  if (toolbarVisibility.fullscreen === false) {
    delete nextSlots.Fullscreen
  }

  if (toolbarVisibility.moreMenu === false) {
    delete nextSlots.MoreMenu
  }

  return nextSlots
}
