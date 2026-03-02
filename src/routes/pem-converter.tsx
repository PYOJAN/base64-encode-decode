import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowLeftRight,
  ClipboardPaste,
  Trash2,
  Upload,
  Copy,
  Download,
  Loader as Spinner,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import {
  inputToBytes,
  detectPemType,
  bytesToPem,
  bytesToHex,
  bytesToBase64,
} from "@/utils/pem"

export const Route = createFileRoute("/pem-converter")({
  component: PemConverterPage,
})

function PemConverterPage() {
  const [input, setInput] = useState("")
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [detectedType, setDetectedType] = useState<string | null>(null)
  const [error, setError] = useState("")
  const { paste, copy, isCopying, isPasting } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setBytes(null)
      setDetectedType(null)
      setError("")
      return
    }
    try {
      const parsed = inputToBytes(debounced)
      if (!parsed) {
        setError(
          "Unable to parse input. Provide PEM, Base64, or hex-encoded DER data."
        )
        setBytes(null)
        return
      }
      setBytes(parsed)
      setDetectedType(detectPemType(debounced))
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse")
      setBytes(null)
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
        setInput(bytesToHex(arr, ""))
      } else {
        setInput(new TextDecoder().decode(arr))
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  const pemType = detectedType ?? "CERTIFICATE"
  const pemOutput = bytes ? bytesToPem(bytes, pemType) : ""
  const b64Output = bytes ? bytesToBase64(bytes) : ""
  const hexOutput = bytes ? bytesToHex(bytes) : ""

  const downloadDer = () => {
    if (!bytes) return
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `output.${pemType.toLowerCase().includes("certificate") ? "der" : "bin"}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={ArrowLeftRight}
        title="PEM / DER Converter"
        description="Convert between PEM (Base64 with headers) and DER (binary) certificate formats."
        badge="PKI"
      />

      {/* Input */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              {isPasting ? (
                <div className="flex items-center">
                  <Spinner className="mr-1.5 h-3.5 w-3.5" />
                  Pasting...
                </div>
              ) : (
                <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              )}
              Paste
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload File
                <input
                  type="file"
                  className="hidden"
                  accept=".pem,.crt,.cer,.der,.key,.pub,.p7b,.p7c,.csr,.req"
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
            placeholder="Paste PEM, Base64, hex, or upload a DER file..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs leading-relaxed"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Output */}
      {bytes && (
        <div className="space-y-4">
          {/* Info */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {bytes.length} bytes
            </Badge>
            {detectedType && (
              <Badge variant="outline" className="text-[10px]">
                {detectedType}
              </Badge>
            )}
          </div>

          {/* PEM Output */}
          <OutputCard
            title="PEM Format"
            value={pemOutput}
            label="PEM"
          />

          {/* Base64 Output */}
          <OutputCard
            title="Raw Base64 (no headers)"
            value={b64Output}
            label="Base64"
          />

          {/* Hex Output */}
          <OutputCard
            title="Hex Dump"
            value={hexOutput}
            label="Hex"
          />

          {/* DER Download */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">DER Binary</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download raw binary DER encoding
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadDer}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download .der
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function OutputCard({
  title,
  value,
  label,
}: {
  title: string
  value: string
  label: string
}) {

  const { isCopying, copy } = useClipboard();

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copy(value, `${label} copied`)}
          >
            {isCopying ? (
              <Spinner className="text-muted-foreground h-3 w-3" />
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
        <Separator />
        <Textarea
          readOnly
          value={value}
          rows={4}
          className="resize-none font-mono text-[11px] leading-relaxed bg-muted/30"
        />
      </CardContent>
    </Card>
  )
}
