import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Globe, Copy, ClipboardPaste, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"

export const Route = createFileRoute("/url-encoder")({
  component: UrlEncoderPage,
})

function UrlEncoderPage() {
  const [activeTab, setActiveTab] = useState<"encode" | "decode">("encode")
  const [input, setInput] = useState("")
  const { copy, paste } = useClipboard()

  const debouncedInput = useDebounce(input, 300)
  const trimmed = debouncedInput.trim()

  let output = ""
  let error = ""

  if (trimmed) {
    try {
      output =
        activeTab === "encode"
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

  const handleTabChange = (value: string) => {
    setActiveTab(value as "encode" | "decode")
    setInput("")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={Globe}
        title="URL Encoder / Decoder"
        description="Encode or decode URL components using percent-encoding in real time."
        badge="Encode / Decode"
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-4"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="encode" className="flex-1 sm:flex-none">
                Encode
              </TabsTrigger>
              <TabsTrigger value="decode" className="flex-1 sm:flex-none">
                Decode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="encode" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Plain Text
                    </h2>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={handlePaste}>
                        <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Paste</span>
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
                  </div>
                  <Textarea
                    placeholder="Type or paste text to encode..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="min-h-[200px] resize-y font-mono text-xs leading-relaxed"
                  />
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono"
                    >
                      {input.length} chars
                    </Badge>
                  </div>
                </div>

                {/* Output */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Encoded Output
                    </h2>
                    {output && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(output)}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </Button>
                    )}
                  </div>
                  <Textarea
                    readOnly
                    value={output}
                    placeholder="Encoded output will appear here..."
                    className="min-h-[200px] resize-y font-mono text-xs leading-relaxed bg-muted/30"
                  />
                  {output && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {output.length} chars
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="decode" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Encoded Input
                    </h2>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={handlePaste}>
                        <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Paste</span>
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
                  </div>
                  <Textarea
                    placeholder="Paste URL-encoded string here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="min-h-[200px] resize-y font-mono text-xs leading-relaxed"
                  />
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono"
                    >
                      {input.length} chars
                    </Badge>
                  </div>
                </div>

                {/* Output */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Decoded Output
                    </h2>
                    {output && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(output)}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </Button>
                    )}
                  </div>
                  <Textarea
                    readOnly
                    value={output}
                    placeholder="Decoded text will appear here..."
                    className="min-h-[200px] resize-y font-mono text-xs leading-relaxed bg-muted/30"
                  />
                  {output && (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {output.length} chars
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <div className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
              <p className="text-xs text-destructive font-mono break-all truncate">
                {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
