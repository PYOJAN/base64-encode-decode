import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileDown,
  ClipboardPaste,
  Download,
  Eye,
  Trash2,
  Loader,
} from "lucide-react"
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
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { base64ToBlob } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"
import { normalizeBase64 } from "@/utils/smart-base64"

export const Route = createFileRoute("/base64-to-pdf")({
  component: Base64ToPdfPage,
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getBase64ByteSize(base64: string) {
  const padding = (base64.match(/=+$/)?.[0].length ?? 0)
  return (base64.length * 3) / 4 - padding
}

function Base64ToPdfPage() {
  const [input, setInput] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const { paste, isPasting } = useClipboard()

  // Strip data URI prefix if present
  const trimmed = input.trim()

  const original = input.trim()
  const normalized = normalizeBase64(input)

  const wasRepaired =
    normalized &&
    original.replace(/\s+/g, "") !== normalized

  const valid = !!normalized && isBase64(normalized)

  const raw = normalized ?? "";

  const byteSize = getBase64ByteSize(raw)

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const handleDownload = () => {
    if (!valid) return

    try {
      const blob = base64ToBlob(raw, "application/pdf")

      // Verify PDF header
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        if (!text.startsWith("%PDF")) {
          alert("This Base64 does not appear to be a valid PDF.")
          return
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "decoded-file.pdf"
        a.click()
        URL.revokeObjectURL(url)
      }

      reader.readAsText(blob.slice(0, 5))
    } catch {
      alert("Invalid Base64 data.")
    }
  }

  const pdfDataUri = `data:application/pdf;base64,${raw}`


  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileDown}
        title="Base64 to PDF"
        description="Paste a Base64 string to preview and download the decoded PDF."
        badge="PDF Tool"
      />

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-muted-foreground">
              Base64 Input
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePaste}
                disabled={isPasting}
              >
                {isPasting ? <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />}
                Paste from Clipboard
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInput("")}
                disabled={!input}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <Textarea
            placeholder="Paste PDF Base64 string or Data URI here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            className="resize-none font-mono text-xs leading-relaxed"
          />

          {trimmed && (
            <div className="flex items-center gap-3">
              <div
                className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-destructive"
                  }`}
              />

              <span className="text-sm font-medium">
                {valid ? "Valid Base64" : "Invalid Base64"}
              </span>

              {valid && (
                <>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    application/pdf
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {formatBytes(byteSize)}
                  </Badge>
                  {wasRepaired && (
                    <Badge variant="outline" className="text-[10px]">
                      Auto-corrected
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {valid && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-3">
              <Button onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-1.5 h-4 w-4" />
                Preview PDF
              </Button>

              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[calc(100vw-16px)] h-[calc(100vh-16px)] max-w-none p-0">
          <VisuallyHidden.Root>
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription>
              Preview of the decoded PDF
            </DialogDescription>
          </VisuallyHidden.Root>

          <div className="flex-1 min-h-0">
            {valid && (
              <PdfViewer data={pdfDataUri} onDownload={handleDownload} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
