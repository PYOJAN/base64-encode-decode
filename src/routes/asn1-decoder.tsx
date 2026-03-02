import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Binary,
  ClipboardPaste,
  Trash2,
  Upload,
  Expand,
  Shrink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ToolPageLayout } from "@/components"
import { Asn1TreeView } from "@/components/asn1-tree-view"
import { useClipboard, useDebounce } from "@/hooks"
import { inputToBytes, detectPemType, bytesToHex } from "@/utils/pem"
import { type Asn1Node, parseAsn1, getTagName } from "@/utils/asn1-parser"

export const Route = createFileRoute("/asn1-decoder")({
  component: Asn1DecoderPage,
})

function Asn1DecoderPage() {
  const [input, setInput] = useState("")
  const [root, setRoot] = useState<Asn1Node | null>(null)
  const [error, setError] = useState("")
  const [expandLevel, setExpandLevel] = useState(4)
  const [byteCount, setByteCount] = useState(0)
  const { paste } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setRoot(null)
      setError("")
      setByteCount(0)
      return
    }
    try {
      const bytes = inputToBytes(debounced)
      if (!bytes) {
        setError(
          "Unable to parse input. Provide PEM, Base64, or hex-encoded DER data."
        )
        setRoot(null)
        return
      }
      setByteCount(bytes.length)
      const parsed = parseAsn1(bytes, 0)
      setRoot(parsed)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse ASN.1")
      setRoot(null)
    }
  }, [debounced])

  const handlePaste = async () => {
    const text = await paste()
    if (text) setInput(text)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer)
      if (arr[0] === 0x30) {
        // Binary DER — convert to hex for display
        setInput(bytesToHex(arr, ""))
      } else {
        setInput(new TextDecoder().decode(arr))
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  const pemType = detectPemType(input)

  return (
    <ToolPageLayout
      variant="scroll"
      icon={Binary}
      title="ASN.1 Decoder"
      description="Parse and inspect ASN.1 DER/BER encoded data structures. Commonly used for certificates, keys, and signatures."
      badge="PKI"
    >

      {/* Input */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              Paste
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload File
                <input
                  type="file"
                  className="hidden"
                  accept=".pem,.crt,.cer,.der,.csr,.req,.p7b,.p7c,.key,.pub"
                  onChange={handleFile}
                />
              </label>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInput("")}
              disabled={!input}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
          <Textarea
            placeholder="Paste PEM, Base64, or hex-encoded DER data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs leading-relaxed"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Output */}
      {root && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Parsed Structure</h3>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {byteCount} bytes
                </Badge>
                {pemType && (
                  <Badge variant="outline" className="text-[10px]">
                    {pemType}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {getTagName(root)}
                  {root.children ? ` (${root.children.length} children)` : ""}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandLevel(99)}
                    >
                      <Expand className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand all</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandLevel(1)}
                    >
                      <Shrink className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Collapse all</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Tree */}
            <div className="rounded-md border bg-muted/20 p-3 overflow-x-auto max-h-[70vh] overflow-y-auto">
              <Asn1TreeView
                key={expandLevel}
                node={root}
                defaultExpanded={expandLevel}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </ToolPageLayout>
  )
}
