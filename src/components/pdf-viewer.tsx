import { useEffect, useState } from "react"
import { AlertCircle, Download, Loader2, X } from "lucide-react"
import {
  VerifyKitProvider,
  Viewer,
  defaultLayoutPlugin,
  useVerification
} from "@trexolab/verifykit-react"
import { revocationPlugin } from "@trexolab/verifykit-plugin-revocation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractBase64Data } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"

interface PdfViewerProps {
  data: string
  title?: string
  className?: string
  onDownload?: () => void
  onClose?: () => void
}

const VERIFYKIT_ASSET_BASE = import.meta.env.BASE_URL

const VERIFYKIT_CONFIG = {
  workerUrl: `${VERIFYKIT_ASSET_BASE}pdf.worker.min.mjs`,
  cMapUrl: `${VERIFYKIT_ASSET_BASE}cmaps/`,
  standardFontDataUrl: `${VERIFYKIT_ASSET_BASE}standard_fonts/`,
  theme: { mode: "system" as const },
  plugins: [
    revocationPlugin({
      endpoint: "https://verifykit.trexolab.com/api/revocation",
    }),
  ],
}

export function PdfViewer(props: PdfViewerProps) {
  return (
    <VerifyKitProvider config={VERIFYKIT_CONFIG}>
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
}: PdfViewerProps) {
  const verification = useVerification()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [layout] = useState(() =>
    defaultLayoutPlugin({
      disable: {
        openFile: true,
        download: Boolean(onDownload),
      },
    })
  )

  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      verification.reset()
      setLoadError(null)

      const trimmed = data.trim()
      if (!trimmed) {
        setLoadError("No PDF data provided.")
        return
      }

      try {
        const input = await resolvePdfInput(trimmed)
        if (cancelled) return

        await verification.load(input, toPdfFileName(title))
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : "Failed to load PDF.")
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
    }
  }, [data, title, verification.load, verification.reset])

  const errorMessage = loadError ?? verification.error
  const isReady = Boolean(verification.fileBuffer)

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
            fileBuffer={verification.fileBuffer}
            fileName={verification.fileName || toPdfFileName(title)}
            plugins={[layout.plugin]}
            signatures={verification.signatures}
            unsignedFields={verification.unsignedFields}
            verificationStatus={verification.status ?? undefined}
            verifying={verification.isLoading}
            signaturePanelOpen={false}
          />
        </div>
      ) : verification.isLoading ? (
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
