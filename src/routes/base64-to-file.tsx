import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileDown, ClipboardPaste, Download, Eye, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from "@/components/ui/dialog"
import { PdfViewer } from "@/components/pdf-viewer"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { extractBase64Data, base64ToBlob } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-file")({
  component: Base64ToFilePage,
})

function Base64ToFilePage() {
  const [input, setInput] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const { paste } = useClipboard()

  const { data, mimeType } = extractBase64Data(input.trim())
  const valid = data.length > 0 && isBase64(data)
  const detectedType = mimeType ?? "application/octet-stream"
  const isPdf = detectedType === "application/pdf"
  const isImage = detectedType.startsWith("image/")

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const handleDownload = () => {
    if (!valid) return
    const blob = base64ToBlob(data, detectedType)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const ext = detectedType.split("/")[1] || "bin"
    a.href = url
    a.download = `decoded-file.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileDown}
        title="Base64 to File"
        description="Decode a Base64 string and download it as a file, or preview PDFs and images."
        badge="Decode"
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
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

          <Textarea
            placeholder="Paste Base64 or Data URI string here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs leading-relaxed"
          />

          {input.trim() && (
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-destructive"}`}
              />
              <span className="text-sm text-muted-foreground">
                {valid
                  ? `Valid Base64 detected`
                  : "Not a valid Base64 string"}
              </span>
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
              <Button onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                Download File
              </Button>
              {(isPdf || isImage) && (
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="mr-1.5 h-4 w-4" />
                  Preview
                </Button>
              )}
            </div>

            {isImage && (
              <div className="overflow-hidden rounded-lg border bg-muted/20 p-4">
                <img
                  src={`data:${detectedType};base64,${data}`}
                  alt="Preview"
                  className="max-h-80 rounded-md object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>File Preview</DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>Preview of decoded file</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>
          {isPdf && (
            <PdfViewer data={`data:application/pdf;base64,${data}`} />
          )}
          {isImage && (
            <img
              src={`data:${detectedType};base64,${data}`}
              alt="Full preview"
              className="max-w-full rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
