import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileUp, Copy, Link, ClipboardPaste, X, Loader, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileDropzone } from "@/components/file-dropzone"
import { BigTextOutput, ToolPageLayout } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import { formatFileSize } from "@/utils/file-reader"
import { encodeFileToBase64, encodeTextToBase64 } from "@/utils/base64-async"

export const Route = createFileRoute("/file-to-base64")({
  component: FileToBase64Page,
})

function FileToBase64Page() {
  const [base64, setBase64] = useState("")
  const [mimeType, setMimeType] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState("")
  const [textInput, setTextInput] = useState("")
  const [isEncoding, setIsEncoding] = useState(false)
  const [error, setError] = useState("")

  const { copy, paste, isCopying, isPasting } = useClipboard()
  const debouncedText = useDebounce(textInput, 300)

  // Every conversion claims a ticket. A slow 50 MB file started first must not overwrite the
  // result of a small one started after it.
  const ticket = useRef(0)

  const handleFile = async (file: File) => {
    const id = ++ticket.current

    setFileName(file.name)
    setFileSize(formatFileSize(file.size))
    setMimeType(file.type || "application/octet-stream")
    setTextInput("")
    setBase64("")
    setError("")
    setIsEncoding(true)

    try {
      const encoded = await encodeFileToBase64(file)
      if (ticket.current !== id) return
      setBase64(encoded)
    } catch {
      if (ticket.current !== id) return
      setError("That file could not be read.")
    } finally {
      if (ticket.current === id) setIsEncoding(false)
    }
  }

  useEffect(() => {
    if (!debouncedText.trim()) return

    const id = ++ticket.current
    setError("")
    setIsEncoding(true)

    encodeTextToBase64(debouncedText)
      .then((encoded) => {
        if (ticket.current !== id) return
        setBase64(encoded)
        setMimeType("text/plain")
        setFileName("")
        setFileSize("")
      })
      .catch(() => {
        if (ticket.current === id) setError("That text could not be encoded.")
      })
      .finally(() => {
        if (ticket.current === id) setIsEncoding(false)
      })
  }, [debouncedText])

  const handleClear = () => {
    ticket.current += 1
    setBase64("")
    setFileName("")
    setFileSize("")
    setMimeType("")
    setTextInput("")
    setError("")
    setIsEncoding(false)
  }

  const handlePasteText = async () => {
    const text = await paste()
    if (text) setTextInput(text)
  }

  // Built on demand rather than held in state: for a 10 MB file this string is another ~14 MB,
  // and keeping a second copy alive for a button nobody may press doubles the page's memory.
  const buildDataUri = () => `data:${mimeType || "text/plain"};base64,${base64}`

  const hasOutput = base64.length > 0
  const dataUriPrefix = mimeType ? `data:${mimeType};base64` : ""

  return (
    <ToolPageLayout
      variant="scroll"
      icon={FileUp}
      title="File to Base64"
      description="Upload a file or enter text to generate Base64 instantly."
      badge="Encode"
      maxWidth="max-w-6xl"
    >
      {/* SIDE BY SIDE SECTION */}
      <div className="grid gap-6 lg:grid-cols-2 items-stretch">

        {/* FILE UPLOAD CARD */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-col flex-1 min-h-0 p-6 gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              File Upload
            </h2>

            <FileDropzone
              onFile={handleFile}
              className="h-full"
              busy={isEncoding}
              busyLabel="Encoding file..."
            />

            {fileName && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{fileName}</Badge>
                <Badge variant="outline">{fileSize}</Badge>
                <Badge variant="outline">{mimeType}</Badge>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
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
              spellCheck={false}
              className="h-64 resize-y font-mono text-sm"
            />
          </CardContent>
        </Card>
      </div>

      {/* RESULT SECTION */}
      {(hasOutput || isEncoding) && (
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

                {isEncoding && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader className="h-3 w-3 animate-spin" />
                    Encoding...
                  </span>
                )}
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-2 flex-wrap">

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCopying || !hasOutput}
                  onClick={() => copy(base64, "Raw Base64 copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "Raw"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCopying || !hasOutput}
                  onClick={() => copy(buildDataUri(), "Data URI copied")}
                >
                  <Link className="mr-1.5 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "Data URI"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCopying || !hasOutput}
                  onClick={() => copy(encodeURIComponent(base64), "URL-encoded copied")}
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

            <BigTextOutput
              value={base64}
              placeholder="Base64 output will appear here..."
              className="h-auto"
              textareaClassName="h-64 resize-y bg-muted/30"
            />
          </CardContent>
        </Card>
      )}
    </ToolPageLayout>
  )
}
