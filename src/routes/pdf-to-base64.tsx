import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileUp,
  Copy,
  Link,
  ClipboardPaste,
  X,
  Eye,
  FileText,
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
import { FileDropzone } from "@/components/file-dropzone"
import { PdfViewer } from "@/components/pdf-viewer"
import { ToolPageLayout } from "@/components"
import { useClipboard } from "@/hooks"
import { getBase64, formatFileSize } from "@/utils/file-reader"

export const Route = createFileRoute("/pdf-to-base64")({
  component: PdfToBase64Page,
})

function PdfToBase64Page() {
  const [output, setOutput] = useState("")
  const [dataUri, setDataUri] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)

  const { copy, isCopying } = useClipboard()

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") return

    setFileName(file.name)
    setFileSize(formatFileSize(file.size))

    const result = await getBase64(file)
    setDataUri(result)

    const raw = result.includes(",") ? result.split(",")[1] ?? "" : result
    setOutput(raw)
  }

  const handleClear = () => {
    setOutput("")
    setDataUri("")
    setFileName("")
    setFileSize("")
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={FileUp}
      title="PDF to Base64"
      description="Upload a PDF file and get its Base64-encoded string. Preview before copying."
      badge="Encode"
    >

      <Card>
        <CardContent className="p-6">
          <FileDropzone
            onFile={handleFile}
            accept=".pdf,application/pdf"
            label="Drop a PDF file here, or click to browse"
            sublabel="Only PDF files accepted"
          />
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="p-6 space-y-4">

            {/* File Info */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>

                <Badge variant="secondary" className="font-mono text-[10px]">
                  {fileSize}
                </Badge>

                <Badge variant="outline" className="font-mono text-[10px]">
                  application/pdf
                </Badge>
              </div>

              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Preview
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Base64 Output */}
            <Textarea
              readOnly
              value={output}
              rows={6}
              className="resize-none font-mono text-xs leading-relaxed bg-muted/30"
            />

            {/* Copy Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isCopying}
                onClick={() => copy(output, "Raw Base64 copied")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {isCopying ? "Copying..." : "Raw Base64"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={isCopying}
                onClick={() => copy(dataUri, "Data URI copied")}
              >
                <Link className="mr-1.5 h-3.5 w-3.5" />
                {isCopying ? "Copying..." : "Base64 Data URI"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={isCopying}
                onClick={() =>
                  copy(encodeURIComponent(output), "URL-encoded copied")
                }
              >
                <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                {isCopying ? "Copying..." : "URL Encoded"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl h-[90vh] flex flex-col p-0">
          <VisuallyHidden.Root>
            <DialogTitle>{fileName}</DialogTitle>
            <DialogDescription>
              Preview of uploaded PDF
            </DialogDescription>
          </VisuallyHidden.Root>

          <div className="flex-1 min-h-0">
            {dataUri && <PdfViewer data={dataUri} />}
          </div>
        </DialogContent>
      </Dialog>
    </ToolPageLayout>
  )
}