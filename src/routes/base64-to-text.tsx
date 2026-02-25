import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileText, ClipboardPaste, Copy, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/page-header"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { base64ToText } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-text")({
  component: Base64ToTextPage,
})

function Base64ToTextPage() {
  const [input, setInput] = useState("")
  const { copy, paste } = useClipboard()

  const debouncedInput = useDebounce(input, 300)
  const trimmed = debouncedInput.trim()
  const valid = trimmed.length > 0 && isBase64(trimmed)

  let decoded = ""
  if (valid) {
    try {
      decoded = base64ToText(trimmed)
    } catch {
      decoded = ""
    }
  }

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const charCount = decoded.length
  const lineCount = decoded ? decoded.split("\n").length : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileText}
        title="Base64 to Text"
        description="Decode a Base64 string to human-readable text in real time."
        badge="Decode"
      />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Input */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-col flex-1 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Base64 Input
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
              placeholder="Paste Base64 string here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 min-h-[180px] sm:min-h-[240px] resize-y font-mono text-xs leading-relaxed"
            />
            {trimmed && (
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-destructive"}`}
                />
                <span className="text-xs text-muted-foreground">
                  {valid ? "Valid Base64" : "Invalid Base64"}
                </span>
                {valid && (
                  <Badge variant="secondary" className="text-[10px] font-mono ml-auto">
                    {trimmed.length} chars
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Arrow indicator (hidden on mobile, shown on lg) */}
        <div className="hidden lg:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 pointer-events-none" aria-hidden>
          {/* This is handled by the grid gap */}
        </div>

        {/* Output */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-col flex-1 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Decoded Text
              </h2>
              {decoded && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(decoded)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>
              )}
            </div>
            <Textarea
              readOnly
              value={decoded}
              placeholder="Decoded text will appear here..."
              className="flex-1 min-h-[180px] sm:min-h-[240px] resize-y font-mono text-xs leading-relaxed bg-muted/30"
            />
            {decoded && (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {charCount} chars
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {lineCount} {lineCount === 1 ? "line" : "lines"}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
