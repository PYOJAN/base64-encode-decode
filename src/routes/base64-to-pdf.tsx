import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileDown,
  ClipboardPaste,
  Download,
  Eye,
  Trash2,
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useClipboard } from "@/hooks/use-clipboard"
import { base64ToBlob } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-pdf")({
  component: Base64ToPdfPage,
})

function Base64ToPdfPage() {
  const [input, setInput] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const { paste } = useClipboard()

  // Strip data URI prefix if present
  const trimmed = input.trim()
  const raw = trimmed.startsWith("data:")
    ? (trimmed.split(",")[1] ?? "")
    : trimmed
  const valid = raw.length > 0 && isBase64(raw)

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const handleDownload = () => {
    if (!valid) return
    const blob = base64ToBlob(raw, "application/pdf")
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "decoded-file.pdf"
    a.click()
    URL.revokeObjectURL(url)
  }

  const pdfDataUri = `data:application/pdf;base64,${raw}`

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileDown}
        title="Base64 to PDF"
        description="Paste a Base64 string to preview and download the decoded PDF."
        badge="PDF"
      />

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              Paste from Clipboard
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInput("")}
                  disabled={!input}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>
          </div>

          <Textarea
            placeholder="Paste PDF Base64 string or Data URI here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs leading-relaxed"
          />

          {trimmed && (
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-destructive"}`}
              />
              <span className="text-sm text-muted-foreground">
                {valid ? "Valid Base64 detected" : "Invalid Base64 string"}
              </span>
              {valid && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  application/pdf
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {valid && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
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

      {/* Floating PDF Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl h-[90vh] sm:h-[85vh] flex flex-col p-0 gap-0">
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
