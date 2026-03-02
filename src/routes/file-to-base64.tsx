import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileUp, Copy, Link, ClipboardPaste, X, Loader } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileDropzone } from "@/components/file-dropzone"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { getBase64, formatFileSize } from "@/utils/file-reader"
import { textToBase64 } from "@/utils/base64"

export const Route = createFileRoute("/file-to-base64")({
  component: FileToBase64Page,
})

function FileToBase64Page() {
  const [rawBase64, setRawBase64] = useState("")
  const [dataUri, setDataUri] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState("")
  const [mimeType, setMimeType] = useState("")
  const [textInput, setTextInput] = useState("")

  const { copy, paste, isCopying, isPasting } = useClipboard()
  const debouncedText = useDebounce(textInput, 300)

  // File upload handling
  const handleFile = async (file: File) => {
    setFileName(file.name)
    setFileSize(formatFileSize(file.size))
    setMimeType(file.type || "application/octet-stream")

    const result = await getBase64(file)
    setDataUri(result)

    const commaIdx = result.indexOf(",")
    setRawBase64(commaIdx >= 0 ? result.substring(commaIdx + 1) : result)
  }

  // Text auto convert
  useEffect(() => {
    if (!debouncedText.trim()) return

    const b64 = textToBase64(debouncedText)
    setRawBase64(b64)
    setDataUri(`data:text/plain;base64,${b64}`)
    setMimeType("text/plain")
    setFileName("")
    setFileSize("")
  }, [debouncedText])

  const handleClear = () => {
    setRawBase64("")
    setDataUri("")
    setFileName("")
    setFileSize("")
    setMimeType("")
    setTextInput("")
  }

  const handlePasteText = async () => {
    const text = await paste()
    if (text) setTextInput(text)
  }

  const hasOutput = rawBase64.length > 0
  const dataUriPrefix = mimeType ? `data:${mimeType};base64` : ""

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileUp}
        title="File to Base64"
        description="Upload a file or enter text to generate Base64 instantly."
        badge="Encode"
      />

      {/* SIDE BY SIDE SECTION */}
      <div className="grid gap-6 lg:grid-cols-2 items-stretch">

        {/* FILE UPLOAD CARD */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-col flex-1 min-h-0 p-6 gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              File Upload
            </h2>

            <FileDropzone onFile={handleFile} className="h-full" />

            {fileName && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{fileName}</Badge>
                <Badge variant="outline">{fileSize}</Badge>
                <Badge variant="outline">{mimeType}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TEXT INPUT CARD */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Text Input
              </h2>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteText}
                disabled={isPasting}
              >
                {isPasting ? <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />}
                Paste from Clipboard
              </Button>
            </div>

            <Textarea
              placeholder="Type or paste text — converts automatically..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="h-64 resize-y font-mono text-sm"
            />
          </CardContent>
        </Card>
      </div>

      {/* RESULT SECTION */}
      {hasOutput && (
        <Card>
          <CardContent className="p-6 space-y-4">

            {/* HEADER */}
            <div className="flex flex-wrap items-center justify-between gap-3">

              {/* Left side */}
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Result
                </h2>

                {dataUriPrefix && (
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] truncate"
                  >
                    {dataUriPrefix}
                  </Badge>
                )}
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-2 flex-wrap">

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCopying}
                  onClick={() => copy(rawBase64, "Raw Base64 copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "Raw"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCopying}
                  onClick={() => copy(dataUri, "Data URI copied")}
                >
                  <Link className="mr-1.5 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "Data URI"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCopying}
                  onClick={() =>
                    copy(
                      encodeURIComponent(rawBase64),
                      "URL-encoded copied"
                    )
                  }
                >
                  <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "URL"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>

            {/* TEXTAREA */}
            <Textarea
              readOnly
              value={rawBase64}
              className="h-64 resize-y font-mono text-xs leading-relaxed bg-muted/30"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}