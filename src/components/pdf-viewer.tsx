import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Download, Loader2, X } from "lucide-react"
import {
  VerifyKitProvider,
  Viewer,
  defaultLayoutPlugin,
  type DefaultLayoutPluginOptions,
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
}: PdfViewerProps) {
  const verification = useVerification()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPreparing, setIsPreparing] = useState(true)
  const viewerRef = useRef<ViewerHandle | null>(null)
  const toolbarVisibility = viewerOptions?.provider?.toolbar

  const layoutKey = JSON.stringify({
    disable: {
      openFile: !onOpenFile,
      download: Boolean(onDownload),
      ...viewerOptions?.layout?.disable,
    },
    toolbar: viewerOptions?.layout?.toolbar,
    accessibility: viewerOptions?.layout?.accessibility,
    toolbarVisibility,
  })

  const layout = useMemo(
    () =>
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
      }),
    [layoutKey, onDownload, onOpenFile, toolbarVisibility, viewerOptions?.layout]
  )

  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      verification.reset()
      setLoadError(null)
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

        await verification.load(input, toPdfFileName(title))
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
  }, [data, title, verification.load, verification.reset])

  useEffect(() => {
    const store = viewerRef.current?.getStore()
    if (!store || viewerOptions?.signaturePanelOpen === undefined) {
      return
    }

    store.update({ sigPanelOpen: viewerOptions.signaturePanelOpen })
  }, [verification.signatures, viewerOptions?.signaturePanelOpen])

  const errorMessage =
    loadError ??
    (verification.error instanceof Error
      ? verification.error.message
      : verification.error
        ? String(verification.error)
        : null)
  const isReady = Boolean(verification.fileBuffer)
  const isLoading = isPreparing || verification.isLoading

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 overflow-hidden rounded-lg border bg-background",
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
        <div className="relative flex-1 min-h-0">
          <Viewer
            ref={viewerRef}
            fileBuffer={verification.fileBuffer}
            fileName={verification.fileName || toPdfFileName(title)}
            plugins={[layout.plugin]}
            signatures={verification.signatures}
            unsignedFields={verification.unsignedFields}
            verificationStatus={verification.status ?? undefined}
            verifying={verification.isLoading}
            signaturePanelOpen={viewerOptions?.signaturePanelOpen ?? false}
            onOpenFile={onOpenFile}
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

async function resolvePdfInput(data: string): Promise<ArrayBuffer | string> {
  if (/^blob:/i.test(data) || isUrlLike(data)) {
    return data
  }

  const { data: rawBase64, mimeType } = extractBase64Data(data)
  const normalized = rawBase64.replace(/\s+/g, "")

  if (mimeType && mimeType !== "application/pdf") {
    throw new Error(`Expected application/pdf but received ${mimeType}.`)
  }

  if (!normalized || !isBase64(normalized)) {
    throw new Error("Unsupported PDF input. Pass a PDF data URI, raw base64, blob URL, or URL.")
  }

  return base64ToArrayBuffer(normalized)
}

function base64ToArrayBuffer(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

function isUrlLike(value: string) {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("/")
}

function toPdfFileName(title?: string) {
  if (!title) return "document.pdf"
  return title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`
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
