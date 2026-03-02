import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Globe, Copy, ClipboardPaste, Trash2, Loader } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"

export const Route = createFileRoute("/url-encoder")({
  component: UrlEncoderPage,
})

function UrlEncoderPage() {
  const [mode, setMode] = useState<"encode" | "decode">("encode")
  const [input, setInput] = useState("")

  const { copy, paste, isCopying, isPasting } = useClipboard()
  const debouncedInput = useDebounce(input, 300)

  const trimmed = debouncedInput.trim()

  let output = ""
  let error = ""

  if (trimmed) {
    try {
      output =
        mode === "encode"
          ? encodeURIComponent(trimmed)
          : decodeURIComponent(trimmed)
    } catch (e) {
      error = (e as Error).message
    }
  }

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const handleClear = () => setInput("")

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] p-4 sm:p-6 gap-6">
      <PageHeader
        icon={Globe}
        title="URL Encoder / Decoder"
        description="Encode or decode URL components using percent-encoding."
        badge="Encode / Decode"
      />

      <Card className="flex flex-col flex-1 min-h-0">
        <CardContent className="flex flex-col flex-1 min-h-0 p-6 gap-6">

          {/* Mode Switch */}
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as "encode" | "decode")
              setInput("")
            }}
          >
            <TabsList>
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Split Layout */}
          <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-2">

            {/* INPUT PANEL */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {mode === "encode" ? "Plain Text" : "Encoded Input"}
                </h2>

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
                    onClick={handleClear}
                    disabled={!input}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === "encode"
                    ? "Type or paste text to encode..."
                    : "Paste encoded string here..."
                }
                className="flex-1 min-h-0 resize-none font-mono text-sm"
              />

              <div className="mt-2 flex justify-between">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {input.length} chars
                </Badge>
              </div>
            </div>

            {/* OUTPUT PANEL */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {mode === "encode" ? "Encoded Output" : "Decoded Output"}
                </h2>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!output || isCopying}
                  onClick={() => copy(output)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "Copy"}
                </Button>
              </div>

              <Textarea
                readOnly
                value={output}
                placeholder="Result will appear here..."
                className="flex-1 min-h-0 resize-none font-mono text-sm bg-muted/30"
              />

              {output && (
                <div className="mt-2 flex justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {output.length} chars
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <p className="text-xs text-destructive font-mono break-all">
                {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}