import { useState, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileText, ClipboardPaste, Copy, Trash2, Loader } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
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

  // return (
  //   <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
  //     <PageHeader
  //       icon={FileText}
  //       title="Base64 to Text"
  //       description="Decode a Base64 string into readable text instantly."
  //       badge="Decode"
  //     />

  //     <div className="grid gap-6 lg:grid-cols-2">
  //       {/* INPUT CARD */}
  //       <Card className="flex flex-col">
  //         <CardContent className="flex flex-col flex-1 p-5 space-y-4">

  //           {/* Header */}
  //           <div className="flex items-center justify-between">
  //             <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  //               Base64 Input
  //             </h2>

  //             <div className="flex gap-1.5">
  //               <Button
  //                 variant="outline"
  //                 size="sm"
  //                 onClick={handlePaste}
  //                 disabled={isPasting}
  //               >
  //                 <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
  //                 {isPasting ? "Reading..." : "Paste"}
  //               </Button>

  //               <Button
  //                 variant="ghost"
  //                 size="sm"
  //                 onClick={handleClear}
  //                 disabled={!input}
  //               >
  //                 <Trash2 className="h-3.5 w-3.5" />
  //               </Button>
  //             </div>
  //           </div>

  //           {/* Textarea */}
  //           <Textarea
  //             ref={inputRef}
  //             placeholder="Paste Base64 string here..."
  //             value={input}
  //             onChange={(e) => setInput(e.target.value)}
  //             className="flex-1 min-h-[220px] resize-y font-mono text-xs leading-relaxed"
  //           />

  //           {/* Status */}
  //           {trimmed && (
  //             <div className="flex items-center gap-3">
  //               <div
  //                 className={`h-2 w-2 rounded-full ${
  //                   valid ? "bg-emerald-500" : "bg-destructive"
  //                 }`}
  //               />

  //               <span className="text-xs text-muted-foreground">
  //                 {valid ? "Valid Base64 detected" : "Invalid Base64"}
  //               </span>

  //               {valid && (
  //                 <Badge variant="secondary" className="ml-auto text-[10px] font-mono">
  //                   {trimmed.length} chars
  //                 </Badge>
  //               )}
  //             </div>
  //           )}
  //         </CardContent>
  //       </Card>

  //       {/* OUTPUT CARD */}
  //       <Card className="flex flex-col">
  //         <CardContent className="flex flex-col flex-1 p-5 space-y-4">

  //           {/* Header */}
  //           <div className="flex items-center justify-between">
  //             <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  //               Decoded Text
  //             </h2>

  //             <Button
  //               variant="outline"
  //               size="sm"
  //               disabled={!decoded || isCopying}
  //               onClick={() => copy(decoded)}
  //             >
  //               <Copy className="mr-1 h-3.5 w-3.5" />
  //               {isCopying ? "Copying..." : "Copy"}
  //             </Button>
  //           </div>

  //           {/* Output */}
  //           <Textarea
  //             readOnly
  //             value={decoded}
  //             placeholder="Decoded text will appear here..."
  //             className="flex-1 min-h-[220px] resize-y font-mono text-xs leading-relaxed bg-muted/30"
  //           />

  //           {/* Metadata */}
  //           {decoded && (
  //             <div className="flex items-center gap-3">
  //               <Badge variant="outline" className="text-[10px] font-mono">
  //                 {charCount} chars
  //               </Badge>
  //               <Badge variant="outline" className="text-[10px] font-mono">
  //                 {lineCount} {lineCount === 1 ? "line" : "lines"}
  //               </Badge>
  //             </div>
  //           )}
  //         </CardContent>
  //       </Card>
  //     </div>
  //   </div>
  // )

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] p-4 sm:p-6 gap-6">
      <PageHeader
        icon={FileText}
        title="Base64 to Text"
        description="Decode a Base64 string into readable text instantly."
        badge="Decode"
      />

      {/* Full Height Grid */}
      <div className="flex-1 min-h-0 grid gap-6 lg:grid-cols-2">

        {/* INPUT CARD */}
        <Card className="flex flex-col min-h-0">
          <CardContent className="flex flex-col flex-1 min-h-0 p-5 gap-4">

            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Base64 Input
              </h2>

              <div className="flex gap-1.5">
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

            {/* Textarea fills remaining space */}
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste Base64 string here..."
              className="flex-1 min-h-0 resize-none font-mono text-xs leading-relaxed"
            />

            {/* Status */}
            {trimmed && (
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-destructive"
                    }`}
                />
                <span className="text-xs text-muted-foreground">
                  {valid ? "Valid Base64" : "Invalid Base64"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OUTPUT CARD */}
        <Card className="flex flex-col min-h-0">
          <CardContent className="flex flex-col flex-1 min-h-0 p-5 gap-4">

            {/* Header */}
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

            {/* Output fills remaining */}
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
    </div>
  )
}