import { useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileText, Copy, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  BigTextOutput,
  ToolPageLayout,
  PasteClearButtons,
  ValidationDot,
} from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import { decodeBase64ToText } from "@/utils/base64-async"
import { isBase64 } from "@/utils/file-reader"

export const Route = createFileRoute("/base64-to-text")({
  component: Base64ToTextPage,
})

function Base64ToTextPage() {
  const [input, setInput] = useState("")
  const [decoded, setDecoded] = useState("")
  const [isDecoding, setIsDecoding] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const { copy, paste, isCopying, isPasting } = useClipboard()
  const debouncedInput = useDebounce(input, 300)

  const trimmed = useMemo(() => debouncedInput.trim(), [debouncedInput])
  const valid = useMemo(() => trimmed.length > 0 && isBase64(trimmed), [trimmed])

  useEffect(() => {
    if (!valid) {
      setDecoded("")
      setIsDecoding(false)
      return
    }

    let cancelled = false
    setIsDecoding(true)

    decodeBase64ToText(trimmed)
      .then((text) => {
        if (!cancelled) setDecoded(text)
      })
      .catch(() => {
        if (!cancelled) setDecoded("")
      })
      .finally(() => {
        if (!cancelled) setIsDecoding(false)
      })

    return () => {
      cancelled = true
    }
  }, [trimmed, valid])

  const charCount = decoded.length

  // `decoded.split("\n").length` allocates an array entry per line — millions of them for a
  // large payload. Scanning for the separator counts the same lines and allocates nothing.
  const lineCount = useMemo(() => {
    if (!decoded) return 0

    let count = 1
    for (let i = decoded.indexOf("\n"); i !== -1; i = decoded.indexOf("\n", i + 1)) count += 1
    return count
  }, [decoded])

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
              spellCheck={false}
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
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Decoded Text
                </h2>
                {isDecoding && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
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

            <BigTextOutput
              value={decoded}
              placeholder="Decoded text will appear here..."
              className="flex-1"
              textareaClassName="bg-muted/30"
            />

            {decoded && (
              <div className="flex gap-3 shrink-0">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {charCount.toLocaleString()} chars
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {lineCount.toLocaleString()} {lineCount === 1 ? "line" : "lines"}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ToolPageLayout>
  )
}
