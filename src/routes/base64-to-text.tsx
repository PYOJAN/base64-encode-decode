import { useState, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileText, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ToolPageLayout,
  PasteClearButtons,
  ValidationDot,
} from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import { base64ToText } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-text")({
  component: Base64ToTextPage,
})

function Base64ToTextPage() {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const { copy, paste, isCopying, isPasting } = useClipboard()
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

  const charCount = decoded.length
  const lineCount = decoded ? decoded.split("\n").length : 0

  const handlePaste = async () => {
    const text = await paste()
    if (text) {
      setInput(text)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleClear = () => {
    setInput("")
    inputRef.current?.focus()
  }

  return (
    <ToolPageLayout
      variant="full-height"
      icon={FileText}
      title="Base64 to Text"
      description="Decode a Base64 string into readable text instantly."
      badge="Decode"
    >
      <div className="flex-1 min-h-0 grid gap-6 lg:grid-cols-2">
        {/* INPUT CARD */}
        <Card className="flex flex-col min-h-0">
          <CardContent className="flex flex-col flex-1 min-h-0 p-5 gap-4">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Base64 Input
              </h2>
              <PasteClearButtons
                onPaste={handlePaste}
                onClear={handleClear}
                isPasting={isPasting}
                clearDisabled={!input}
              />
            </div>

            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste Base64 string here..."
              className="flex-1 min-h-0 resize-none font-mono text-xs leading-relaxed"
            />

            <ValidationDot
              show={!!trimmed}
              valid={valid}
              validLabel="Valid Base64"
              invalidLabel="Invalid Base64"
            />
          </CardContent>
        </Card>

        {/* OUTPUT CARD */}
        <Card className="flex flex-col min-h-0">
          <CardContent className="flex flex-col flex-1 min-h-0 p-5 gap-4">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Decoded Text
              </h2>
              <Button
                variant="outline"
                size="sm"
                disabled={!decoded || isCopying}
                onClick={() => copy(decoded)}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                {isCopying ? "Copying..." : "Copy"}
              </Button>
            </div>

            <Textarea
              readOnly
              value={decoded}
              placeholder="Decoded text will appear here..."
              className="flex-1 min-h-0 resize-none font-mono text-xs leading-relaxed bg-muted/30"
            />

            {decoded && (
              <div className="flex gap-3 shrink-0">
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
    </ToolPageLayout>
  )
}
