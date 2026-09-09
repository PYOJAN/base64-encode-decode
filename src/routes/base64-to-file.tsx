import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileDown, Download, Eye, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from "@/components/ui/dialog"
import { PdfViewer } from "@/components/pdf-viewer"
import {
  ToolPageLayout,
  PasteClearButtons,
  ValidationDot,
} from "@/components"
import { useClipboard } from "@/hooks"
import { extractBase64Data } from "@/utils/base64"
import { decodeBase64ToBytes } from "@/utils/base64-async"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-file")({
  component: Base64ToFilePage,
})

function Base64ToFilePage() {
  const [input, setInput] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const { paste, isPasting } = useClipboard()

  // Parsing and validating walks the entire payload, so it runs against a deferred copy of the
  // input: keystrokes stay responsive and the check catches up a frame later.
  const deferredInput = useDeferredValue(input)
  const { data, detectedType, valid, isPdf, isImage } = useMemo(() => {
    const parsed = extractBase64Data(deferredInput.trim())
    const type = parsed.mimeType ?? "application/octet-stream"

    return {
      data: parsed.data,
      detectedType: type,
      valid: parsed.data.length > 0 && isBase64(parsed.data),
      isPdf: type === "application/pdf",
      isImage: type.startsWith("image/"),
    }
  }, [deferredInput])

  const previewable = valid && (isPdf || isImage)

  /**
   * Previews run off an object URL rather than a `data:` attribute. Interpolating the payload
   * into `src` rebuilds a multi-megabyte string on every render and forces the browser to
   * re-parse it; a blob is decoded once and handed over by reference.
   */
  useEffect(() => {
    if (!previewable) {
      setObjectUrl(null)
      return
    }

    let cancelled = false

    void decodeBase64ToBytes(data)
      .then((bytes) => {
        if (cancelled) return
        setObjectUrl(URL.createObjectURL(new Blob([bytes], { type: detectedType })))
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [data, detectedType, previewable])

  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const handleDownload = async () => {
    if (!valid || isDownloading) return

    setIsDownloading(true)
    try {
      const bytes = await decodeBase64ToBytes(data)
      const url = URL.createObjectURL(new Blob([bytes], { type: detectedType }))
      const link = document.createElement("a")

      link.href = url
      link.download = `decoded-file.${detectedType.split("/")[1] || "bin"}`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("That Base64 could not be decoded.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={FileDown}
      title="Base64 to File"
      description="Decode a Base64 string and download it as a file, or preview PDFs and images."
      badge="Decode"
    >
      <Card>
        <CardContent className="p-6 space-y-4">
          <PasteClearButtons
            onPaste={handlePaste}
            onClear={() => setInput("")}
            isPasting={isPasting}
            clearDisabled={!input}
          />

          <Textarea
            placeholder="Paste Base64 or Data URI string here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            spellCheck={false}
            className="resize-none font-mono text-xs leading-relaxed"
          />

          {deferredInput.trim() && (
            <div className="flex items-center gap-2">
              <ValidationDot
                show
                valid={valid}
                validLabel="Valid Base64 detected"
                invalidLabel="Not a valid Base64 string"
              />
              {valid && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {detectedType}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {valid && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Download File
              </Button>

              {previewable && (
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  disabled={!objectUrl}
                >
                  {objectUrl ? (
                    <Eye className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Preview
                </Button>
              )}
            </div>

            {isImage && objectUrl && (
              <div className="overflow-hidden rounded-lg border bg-muted/20 p-4">
                <img
                  src={objectUrl}
                  alt="Preview"
                  className="max-h-80 rounded-md object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="pdf-preview-dialog flex h-[90vh] w-[85vw] max-w-[85vw] flex-col overflow-visible border-0 bg-transparent p-0 shadow-none">
          <VisuallyHidden.Root>
            <DialogTitle>File Preview</DialogTitle>
            <DialogDescription>
              Preview of decoded file
            </DialogDescription>
          </VisuallyHidden.Root>

          <div className="flex-1 min-h-0 overflow-hidden rounded-lg bg-background">
            {isPdf && objectUrl && (
              <PdfViewer
                data={objectUrl}
                title="Decoded PDF Preview"
                onDownload={handleDownload}
              />
            )}

            {isImage && objectUrl && (
              <div className="h-full flex flex-col overflow-hidden rounded-lg border bg-background">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
                  <span className="text-xs font-medium text-muted-foreground truncate">Image Preview</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setPreviewOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 bg-muted/20 flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={objectUrl}
                    alt="Full preview"
                    className="max-w-full max-h-full rounded shadow-lg object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ToolPageLayout>
  )
}
