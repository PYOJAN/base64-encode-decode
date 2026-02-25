import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileUp, Copy, Link, ClipboardPaste, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  const [activeTab, setActiveTab] = useState<"file" | "text">("file")
  const [rawBase64, setRawBase64] = useState("")
  const [dataUri, setDataUri] = useState("")
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState("")
  const [mimeType, setMimeType] = useState("")
  const [textInput, setTextInput] = useState("")
  const { copy } = useClipboard()
  const debouncedText = useDebounce(textInput, 300)

  const handleFile = async (file: File) => {
    setFileName(file.name)
    setFileSize(formatFileSize(file.size))
    setMimeType(file.type || "unknown")
    const result = await getBase64(file)
    setDataUri(result)
    const commaIdx = result.indexOf(",")
    setRawBase64(commaIdx >= 0 ? result.substring(commaIdx + 1) : result)
  }

  // Auto-convert text input — only when text tab is active
  useEffect(() => {
    if (activeTab !== "text") return
    if (!debouncedText.trim()) {
      setRawBase64("")
      setDataUri("")
      setMimeType("")
      return
    }
    const b64 = textToBase64(debouncedText)
    setRawBase64(b64)
    setDataUri(`data:text/plain;base64,${b64}`)
    setMimeType("text/plain")
  }, [debouncedText, activeTab])

  const handleTabChange = (value: string) => {
    const tab = value as "file" | "text"
    setActiveTab(tab)
    // Clear output when switching tabs to avoid stale results
    setRawBase64("")
    setDataUri("")
    setFileName("")
    setFileSize("")
    setMimeType("")
  }

  const handleClear = () => {
    setRawBase64("")
    setDataUri("")
    setFileName("")
    setFileSize("")
    setMimeType("")
    setTextInput("")
  }

  const hasOutput = rawBase64.length > 0
  const dataUriPrefix = mimeType ? `data:${mimeType};base64` : ""

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileUp}
        title="File to Base64"
        description="Convert any file or text into a Base64-encoded string."
        badge="Encode"
      />

      <Card>
        <CardContent className="p-6">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-4"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="file" className="flex-1 sm:flex-none">
                File Upload
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1 sm:flex-none">
                Text Input
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              <FileDropzone onFile={handleFile} />
            </TabsContent>

            <TabsContent value="text" className="space-y-3">
              <Textarea
                placeholder="Type or paste text to encode — converts automatically..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={5}
                className="resize-none"
              />
              {textInput.trim() && (
                <p className="text-xs text-muted-foreground">
                  Auto-converting as you type...
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {hasOutput && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                  Result
                </h2>
                {dataUriPrefix && (
                  <Badge variant="secondary" className="font-mono text-[10px] truncate">
                    {dataUriPrefix}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            </div>

            {fileName && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {fileName}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {fileSize}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {mimeType}
                </Badge>
              </div>
            )}

            <Textarea
              readOnly
              value={rawBase64}
              rows={6}
              className="resize-none font-mono text-xs leading-relaxed bg-muted/30"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(rawBase64, "Raw Base64 copied")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Raw Base64
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(dataUri, "Data URI copied")}
              >
                <Link className="mr-1.5 h-3.5 w-3.5" />
                Data URI
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copy(
                    encodeURIComponent(rawBase64),
                    "URL-encoded copied"
                  )
                }
              >
                <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                URL-encoded
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
