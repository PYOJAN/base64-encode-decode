import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileSearch,
  ClipboardPaste,
  Trash2,
  Upload,
  ShieldX,
  FileDigit,
  ShieldCheck,
  Key,
  Fingerprint,
  Puzzle,
  Globe,
  Binary,
  Loader,
} from "lucide-react"
import {
  Pkcs10CertificateRequest,
  SubjectAlternativeNameExtension,
  type Extension,
} from "@peculiar/x509"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Asn1TreeView } from "@/components/asn1-tree-view"
import {
  ToolPageLayout,
  SectionCard,
  InfoRow,
} from "@/components"
import {
  DnDisplay,
  PublicKeyDisplay,
  OtherExtensionItem,
} from "@/components/cert-display"
import { useClipboard, useDebounce } from "@/hooks"
import {
  inputToBytes,
  detectPemType,
  fingerprint,
} from "@/utils/pem"
import { parseAsn1 } from "@/utils/asn1-parser"
import {
  formatAlgorithm,
  formatFingerprint,
  extractCN,
} from "@/utils/cert-helpers"

export const Route = createFileRoute("/csr-decoder")({
  component: CsrDecoderPage,
})

// ── Page ──

function CsrDecoderPage() {
  const [input, setInput] = useState("")
  const [csr, setCsr] = useState<Pkcs10CertificateRequest | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState("")
  const [sha256, setSha256] = useState("")
  const [sha1, setSha1] = useState("")
  const { paste, isPasting } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setCsr(null)
      setBytes(null)
      setError("")
      setSha256("")
      setSha1("")
      return
    }
    try {
      const rawBytes = inputToBytes(debounced)
      if (!rawBytes) {
        setError(
          "Unable to parse input. Provide a PEM-encoded CSR, Base64, or hex-encoded DER."
        )
        setCsr(null)
        setBytes(null)
        return
      }

      const pemType = detectPemType(debounced)

      // Try to parse as CSR
      let parsed: Pkcs10CertificateRequest | null = null
      if (
        pemType === "CERTIFICATE REQUEST" ||
        pemType === "NEW CERTIFICATE REQUEST" ||
        !pemType
      ) {
        try {
          parsed = new Pkcs10CertificateRequest(rawBytes.buffer as ArrayBuffer)
        } catch {
          // not a CSR
        }
      }

      if (!parsed) {
        // Try anyway even if PEM header doesn't match
        try {
          parsed = new Pkcs10CertificateRequest(rawBytes.buffer as ArrayBuffer)
        } catch {
          setError(
            "Unable to parse as a Certificate Signing Request (PKCS#10). Check the input format."
          )
          setCsr(null)
          setBytes(null)
          return
        }
      }

      setCsr(parsed)
      setBytes(rawBytes)
      setError("")

      fingerprint(rawBytes, "SHA-256").then(setSha256)
      fingerprint(rawBytes, "SHA-1").then(setSha1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse input")
      setCsr(null)
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
        const b64 = btoa(String.fromCharCode(...arr))
        setInput(b64)
      } else {
        setInput(new TextDecoder().decode(arr))
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={FileSearch}
      title="CSR Decoder"
      description="Decode and inspect Certificate Signing Requests (PKCS#10). All processing happens locally in your browser."
      badge="Certificate / Signing"
    >
      {/* Input */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              {isPasting ? (
                <Loader className="animate-spin mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              )}
              Paste
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload CSR
                <input
                  type="file"
                  className="hidden"
                  accept=".pem,.csr,.req,.der,.txt"
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
            placeholder={`-----BEGIN CERTIFICATE REQUEST-----\nMIIC...\n-----END CERTIFICATE REQUEST-----`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs leading-relaxed"
          />
          {error && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <ShieldX className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Output */}
      {csr && bytes && (
        <Tabs defaultValue="decoded">
          <TabsList className="mb-4">
            <TabsTrigger value="decoded">Decoded</TabsTrigger>
            <TabsTrigger value="asn1">
              <Binary className="mr-1.5 h-3.5 w-3.5" />
              ASN.1 Tree
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decoded" className="space-y-4">
            <CsrDetailsView csr={csr} sha256={sha256} sha1={sha1} />
          </TabsContent>

          <TabsContent value="asn1">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="rounded-md border bg-muted/20 p-3 overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <Asn1Tree bytes={bytes} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </ToolPageLayout>
  )
}

// ── ASN.1 Tree wrapper ──

function Asn1Tree({ bytes }: { bytes: Uint8Array }) {
  try {
    const root = parseAsn1(bytes, 0)
    return <Asn1TreeView node={root} defaultExpanded={3} />
  } catch (e) {
    return (
      <p className="text-sm text-destructive">
        Failed to parse ASN.1: {e instanceof Error ? e.message : String(e)}
      </p>
    )
  }
}

// ── CSR Details View ──

function CsrDetailsView({
  csr,
  sha256,
  sha1,
}: {
  csr: Pkcs10CertificateRequest
  sha256: string
  sha1: string
}) {
  const subjectCN = extractCN(csr.subject)

  // Extract SAN from extensions
  let san: SubjectAlternativeNameExtension | null = null
  const otherExtensions: Extension[] = []

  try {
    for (const ext of csr.extensions) {
      if (ext.type === "2.5.29.17") {
        // SubjectAlternativeNames
        san = new SubjectAlternativeNameExtension(ext.rawData)
      } else {
        otherExtensions.push(ext)
      }
    }
  } catch {
    // extensions may not be available
  }

  // Parse SAN names
  const sanNames: { type: string; value: string }[] = []
  if (san) {
    try {
      for (const gn of san.names.items) {
        if (gn.type === "dns") sanNames.push({ type: "DNS", value: gn.value })
        else if (gn.type === "ip") sanNames.push({ type: "IP", value: gn.value })
        else if (gn.type === "email")
          sanNames.push({ type: "Email", value: gn.value })
        else if (gn.type === "url")
          sanNames.push({ type: "URI", value: gn.value })
        else sanNames.push({ type: gn.type, value: String(gn.value) })
      }
    } catch {
      // fallback
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <Card className="border-sky-500/30 bg-sky-500/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <FileDigit className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">
                  {subjectCN || "Certificate Signing Request"}
                </p>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  PKCS#10
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Signature: {formatAlgorithm(csr.signatureAlgorithm)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subject */}
      <SectionCard icon={ShieldCheck} title="Subject">
        <DnDisplay dn={csr.subject} />
      </SectionCard>

      {/* Public Key Info */}
      <SectionCard icon={Key} title="Public Key Info">
        <PublicKeyDisplay
          algorithm={
            csr.publicKey.algorithm as KeyAlgorithm & {
              modulusLength?: number
              namedCurve?: string
            }
          }
        />
      </SectionCard>

      {/* Subject Alternative Names */}
      {sanNames.length > 0 && (
        <SectionCard
          icon={Globe}
          title={`Subject Alternative Names (${sanNames.length})`}
        >
          <div className="space-y-1.5">
            {sanNames.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono px-1.5 py-0 shrink-0"
                >
                  {n.type}
                </Badge>
                <span className="font-mono break-all">{n.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Other Extensions */}
      {otherExtensions.length > 0 && (
        <SectionCard
          icon={Puzzle}
          title={`Extensions (${otherExtensions.length})`}
        >
          <div className="space-y-2">
            {otherExtensions.map((ext, i) => (
              <OtherExtensionItem key={i} ext={ext} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Fingerprints */}
      <SectionCard icon={Fingerprint} title="Fingerprints">
        <div className="space-y-2">
          <InfoRow label="SHA-256" value={formatFingerprint(sha256)} mono />
          <InfoRow label="SHA-1" value={formatFingerprint(sha1)} mono />
        </div>
      </SectionCard>
    </div>
  )
}
