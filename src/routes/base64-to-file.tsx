import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileDown, Download, Eye } from "lucide-react"
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
import {
  ToolPageLayout,
  PasteClearButtons,
  ValidationDot,
} from "@/components"
import { useClipboard } from "@/hooks"
import { extractBase64Data, base64ToBlob } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-file")({
  component: Base64ToFilePage,
})

function Base64ToFilePage() {
  const [input, setInput] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)

  const { paste, isPasting } = useClipboard()

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
            className="resize-none font-mono text-xs leading-relaxed"
          />

          {input.trim() && (
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
              <Button onClick={handleDownload}>
                <Download className="mr-1.5 h-4 w-4" />
                Download File
              </Button>

              {(isPdf || isImage) && (
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
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
        <DialogContent className="max-w-[100vw] w-screen h-screen max-h-screen flex flex-col p-0 border-0 rounded-none">
          <VisuallyHidden.Root>
            <DialogTitle>File Preview</DialogTitle>
            <DialogDescription>
              Preview of decoded file
            </DialogDescription>
          </VisuallyHidden.Root>

          <div className="flex-1 min-h-0">
            {isPdf && (
              <PdfViewer
                data={`data:application/pdf;base64,${data}`}
                title="Decoded PDF Preview"
                onDownload={handleDownload}
                onClose={() => setPreviewOpen(false)}
              />
            )}

            {isImage && (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
                  <span className="text-xs font-medium text-muted-foreground truncate">Image Preview</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setPreviewOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 bg-muted/20 flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={`data:${detectedType};base64,${data}`}
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
