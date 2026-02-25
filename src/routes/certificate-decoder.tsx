import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  ShieldCheck,
  ClipboardPaste,
  Trash2,
  Upload,
  Copy,
  ShieldAlert,
  ShieldX,
  Clock,
  Key,
  FileDigit,
  Fingerprint,
  Puzzle,
  Globe,
  ChevronRight,
  Link2,
  BookOpen,
  Award,
  Info,
  Binary,
} from "lucide-react"
import {
  X509Certificate,
  Pkcs10CertificateRequest,
  BasicConstraintsExtension,
  KeyUsagesExtension,
  ExtendedKeyUsageExtension,
  SubjectAlternativeNameExtension,
  AuthorityKeyIdentifierExtension,
  SubjectKeyIdentifierExtension,
  CRLDistributionPointsExtension,
  AuthorityInfoAccessExtension,
  CertificatePolicyExtension,
  KeyUsageFlags,
} from "@peculiar/x509"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/page-header"
import { Asn1TreeView } from "@/components/asn1-tree-view"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import {
  inputToBytes,
  detectPemType,
  fingerprint,
  bytesToHex,
} from "@/utils/pem"
import { parseAsn1 } from "@/utils/asn1-parser"
import { resolveOid } from "@/utils/oids"

export const Route = createFileRoute("/certificate-decoder")({
  component: CertificateDecoderPage,
})

// ── Types ──

interface CertResult {
  type: "cert"
  cert: X509Certificate
  bytes: Uint8Array
}
interface CsrResult {
  type: "csr"
  csr: Pkcs10CertificateRequest
  bytes: Uint8Array
}
type DecodeResult = CertResult | CsrResult

// ── Key Usage Flag Names ──

const KEY_USAGE_MAP: [number, string][] = [
  [KeyUsageFlags.digitalSignature, "Digital Signature"],
  [KeyUsageFlags.nonRepudiation, "Non Repudiation"],
  [KeyUsageFlags.keyEncipherment, "Key Encipherment"],
  [KeyUsageFlags.dataEncipherment, "Data Encipherment"],
  [KeyUsageFlags.keyAgreement, "Key Agreement"],
  [KeyUsageFlags.keyCertSign, "Certificate Sign"],
  [KeyUsageFlags.cRLSign, "CRL Sign"],
  [KeyUsageFlags.encipherOnly, "Encipher Only"],
  [KeyUsageFlags.decipherOnly, "Decipher Only"],
]

// ── Page ──

function CertificateDecoderPage() {
  const [input, setInput] = useState("")
  const [result, setResult] = useState<DecodeResult | null>(null)
  const [error, setError] = useState("")
  const [sha256, setSha256] = useState("")
  const [sha1, setSha1] = useState("")
  const { paste, copy } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setResult(null)
      setError("")
      setSha256("")
      setSha1("")
      return
    }
    try {
      const bytes = inputToBytes(debounced)
      if (!bytes) {
        setError(
          "Unable to parse input. Provide a PEM-encoded certificate, Base64, or hex-encoded DER."
        )
        setResult(null)
        return
      }

      const pemType = detectPemType(debounced)

      if (
        pemType === "CERTIFICATE REQUEST" ||
        pemType === "NEW CERTIFICATE REQUEST"
      ) {
        const csr = new Pkcs10CertificateRequest(bytes.buffer as ArrayBuffer)
        setResult({ type: "csr", csr, bytes })
        setError("")
      } else {
        try {
          const cert = new X509Certificate(bytes.buffer as ArrayBuffer)
          setResult({ type: "cert", cert, bytes })
          setError("")
        } catch {
          try {
            const csr = new Pkcs10CertificateRequest(bytes.buffer as ArrayBuffer)
            setResult({ type: "csr", csr, bytes })
            setError("")
          } catch {
            setError(
              "Unable to parse as X.509 certificate or CSR. Try the ASN.1 Decoder for raw inspection."
            )
            setResult(null)
          }
        }
      }

      fingerprint(bytes, "SHA-256").then(setSha256)
      fingerprint(bytes, "SHA-1").then(setSha1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse input")
      setResult(null)
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
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={ShieldCheck}
        title="Certificate Decoder"
        description="Decode and inspect X.509 certificates and CSRs. All processing happens locally in your browser."
        badge="PKI"
      />

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
                Upload DER/PEM
                <input
                  type="file"
                  className="hidden"
                  accept=".pem,.crt,.cer,.der,.csr,.req"
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
            placeholder={`-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----`}
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
      {result && (
        <Tabs defaultValue="decoded">
          <TabsList className="mb-4">
            <TabsTrigger value="decoded">Decoded</TabsTrigger>
            <TabsTrigger value="asn1">
              <Binary className="mr-1.5 h-3.5 w-3.5" />
              ASN.1 Tree
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decoded" className="space-y-4">
            {result.type === "cert" && (
              <CertificateView cert={result.cert} sha256={sha256} sha1={sha1} copy={copy} />
            )}
            {result.type === "csr" && (
              <CsrView csr={result.csr} sha256={sha256} sha1={sha1} copy={copy} />
            )}
          </TabsContent>

          <TabsContent value="asn1">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="rounded-md border bg-muted/20 p-3 overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <Asn1Tree bytes={result.bytes} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
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

// ── Certificate View ──

function CertificateView({
  cert,
  sha256,
  sha1,
  copy,
}: {
  cert: X509Certificate
  sha256: string
  sha1: string
  copy: (text: string, label?: string) => Promise<void>
}) {
  const now = new Date()
  const notBefore = cert.notBefore
  const notAfter = cert.notAfter
  const isExpired = now > notAfter
  const isNotYetValid = now < notBefore
  const isValid = !isExpired && !isNotYetValid
  const daysLeft = Math.ceil(
    (notAfter.getTime() - now.getTime()) / 86400000
  )
  const isSelfSigned = cert.subject === cert.issuer
  const totalDays = Math.ceil(
    (notAfter.getTime() - notBefore.getTime()) / 86400000
  )
  const elapsedDays = Math.ceil(
    (now.getTime() - notBefore.getTime()) / 86400000
  )
  const progressPct = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100))

  // Extract extensions
  const basicConstraints = cert.getExtension(BasicConstraintsExtension)
  const keyUsage = cert.getExtension(KeyUsagesExtension)
  const extKeyUsage = cert.getExtension(ExtendedKeyUsageExtension)
  const san = cert.getExtension(SubjectAlternativeNameExtension)
  const ski = cert.getExtension(SubjectKeyIdentifierExtension)
  const aki = cert.getExtension(AuthorityKeyIdentifierExtension)
  const crlDist = cert.getExtension(CRLDistributionPointsExtension)
  const aia = cert.getExtension(AuthorityInfoAccessExtension)
  const certPolicy = cert.getExtension(CertificatePolicyExtension)

  // Find extensions not covered by typed getters
  const knownOids = new Set([
    "2.5.29.19", "2.5.29.15", "2.5.29.37", "2.5.29.17",
    "2.5.29.14", "2.5.29.35", "2.5.29.31", "1.3.6.1.5.5.7.1.1",
    "2.5.29.32",
  ])
  const otherExtensions = cert.extensions.filter(
    (e) => !knownOids.has(e.type)
  )

  const subjectCN = extractCN(cert.subject)

  return (
    <div className="space-y-4">
      {/* ── Status Banner ── */}
      <Card
        className={
          isValid
            ? "border-emerald-500/30 bg-emerald-500/5"
            : isExpired
              ? "border-destructive/30 bg-destructive/5"
              : "border-amber-500/30 bg-amber-500/5"
        }
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            {isValid ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : isExpired ? (
              <ShieldX className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">
                  {subjectCN || cert.subject}
                </p>
                {isSelfSigned && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Self-Signed
                  </Badge>
                )}
                {basicConstraints?.ca && (
                  <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-400/30 shrink-0">
                    CA
                  </Badge>
                )}
                <Badge
                  variant={isValid ? "secondary" : "destructive"}
                  className="text-[10px] shrink-0"
                >
                  {isValid ? "Valid" : isExpired ? "Expired" : "Not Yet Valid"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isValid
                  ? `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                  : isExpired
                    ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} ago`
                    : `Valid from ${notBefore.toLocaleDateString()}`}
                {" · "}
                {isSelfSigned ? "Self-signed" : "CA-signed"}
                {" · "}
                {formatAlgorithm(cert.signatureAlgorithm)}
              </p>
            </div>
          </div>

          {/* Validity progress bar */}
          {!isNotYetValid && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isExpired
                      ? "bg-destructive"
                      : progressPct > 90
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{notBefore.toLocaleDateString()}</span>
                <span>{notAfter.toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Certificate Info ── */}
      <Section icon={FileDigit} title="Certificate Details">
        <div className="space-y-2">
          <InfoRow label="Version" value="3 (0x2)" />
          <InfoRow label="Serial Number" value={formatSerial(cert.serialNumber)} mono copy={copy} />
          <InfoRow
            label="Signature Algorithm"
            value={formatAlgorithm(cert.signatureAlgorithm)}
          />
          <InfoRow
            label="DER Size"
            value={`${(cert.rawData as ArrayBuffer).byteLength} bytes`}
          />
        </div>
      </Section>

      {/* ── Subject ── */}
      <Section icon={ShieldCheck} title="Subject">
        <DnDisplay dn={cert.subject} />
      </Section>

      {/* ── Issuer ── */}
      <Section icon={Award} title="Issuer">
        <DnDisplay dn={cert.issuer} />
      </Section>

      {/* ── Validity ── */}
      <Section icon={Clock} title="Validity Period">
        <div className="space-y-2">
          <InfoRow label="Not Before" value={formatDate(notBefore)} />
          <InfoRow label="Not After" value={formatDate(notAfter)} />
          <InfoRow label="Duration" value={`${totalDays} days`} />
        </div>
      </Section>

      {/* ── Public Key ── */}
      <Section icon={Key} title="Public Key Info">
        <PublicKeyDisplay
          algorithm={
            cert.publicKey.algorithm as KeyAlgorithm & {
              modulusLength?: number
              namedCurve?: string
            }
          }
        />
      </Section>

      {/* ── Subject Alternative Names ── */}
      {san && <SanSection san={san} />}

      {/* ── Key Usage ── */}
      {keyUsage && <KeyUsageSection ext={keyUsage} />}

      {/* ── Extended Key Usage ── */}
      {extKeyUsage && <ExtKeyUsageSection ext={extKeyUsage} />}

      {/* ── Basic Constraints ── */}
      {basicConstraints && <BasicConstraintsSection ext={basicConstraints} />}

      {/* ── Subject / Authority Key Identifiers ── */}
      {(ski || aki) && (
        <Section icon={Key} title="Key Identifiers">
          <div className="space-y-2">
            {ski && (
              <InfoRow label="Subject Key ID" value={ski.keyId} mono copy={copy} />
            )}
            {aki?.keyId && (
              <InfoRow label="Authority Key ID" value={aki.keyId} mono copy={copy} />
            )}
          </div>
        </Section>
      )}

      {/* ── CRL Distribution Points ── */}
      {crlDist && <CrlSection ext={crlDist} />}

      {/* ── Authority Information Access ── */}
      {aia && <AiaSection ext={aia} />}

      {/* ── Certificate Policies ── */}
      {certPolicy && <PolicySection ext={certPolicy} />}

      {/* ── Other Extensions ── */}
      {otherExtensions.length > 0 && (
        <Section icon={Puzzle} title={`Other Extensions (${otherExtensions.length})`}>
          <div className="space-y-2">
            {otherExtensions.map((ext, i) => (
              <OtherExtensionItem key={i} ext={ext} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Fingerprints ── */}
      <Section icon={Fingerprint} title="Fingerprints">
        <div className="space-y-2">
          <InfoRow label="SHA-256" value={formatFingerprint(sha256)} mono copy={copy} />
          <InfoRow label="SHA-1" value={formatFingerprint(sha1)} mono copy={copy} />
        </div>
      </Section>
    </div>
  )
}

// ── CSR View ──

function CsrView({
  csr,
  sha256,
  sha1,
  copy,
}: {
  csr: Pkcs10CertificateRequest
  sha256: string
  sha1: string
  copy: (text: string, label?: string) => Promise<void>
}) {
  const subjectCN = extractCN(csr.subject)

  return (
    <div className="space-y-4">
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

      <Section icon={ShieldCheck} title="Subject">
        <DnDisplay dn={csr.subject} />
      </Section>

      <Section icon={Key} title="Public Key Info">
        <PublicKeyDisplay
          algorithm={
            csr.publicKey.algorithm as KeyAlgorithm & {
              modulusLength?: number
              namedCurve?: string
            }
          }
        />
      </Section>

      <Section icon={Fingerprint} title="Fingerprints">
        <div className="space-y-2">
          <InfoRow label="SHA-256" value={formatFingerprint(sha256)} mono copy={copy} />
          <InfoRow label="SHA-1" value={formatFingerprint(sha1)} mono copy={copy} />
        </div>
      </Section>
    </div>
  )
}

// ── Extension Sections ──

function SanSection({ san }: { san: SubjectAlternativeNameExtension }) {
  const names: { type: string; value: string }[] = []
  try {
    for (const gn of san.names.items) {
      if (gn.type === "dns") names.push({ type: "DNS", value: gn.value })
      else if (gn.type === "ip") names.push({ type: "IP", value: gn.value })
      else if (gn.type === "email") names.push({ type: "Email", value: gn.value })
      else if (gn.type === "url") names.push({ type: "URI", value: gn.value })
      else names.push({ type: gn.type, value: String(gn.value) })
    }
  } catch {
    // fallback if names iteration fails
  }

  if (names.length === 0) return null

  return (
    <Section icon={Globe} title={`Subject Alternative Names (${names.length})`}>
      <div className="space-y-1.5">
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
              {n.type}
            </Badge>
            <span className="font-mono break-all">{n.value}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function KeyUsageSection({ ext }: { ext: KeyUsagesExtension }) {
  const active: string[] = []
  for (const [flag, name] of KEY_USAGE_MAP) {
    if (ext.usages & flag) active.push(name)
  }
  return (
    <Section icon={Key} title="Key Usage">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {active.map((name) => (
            <Badge key={name} variant="secondary" className="text-[11px]">
              {name}
            </Badge>
          ))}
        </div>
        {ext.critical && (
          <p className="text-[10px] text-muted-foreground">
            This extension is marked as <span className="text-destructive font-medium">critical</span>.
          </p>
        )}
      </div>
    </Section>
  )
}

function ExtKeyUsageSection({ ext }: { ext: ExtendedKeyUsageExtension }) {
  return (
    <Section icon={Puzzle} title="Extended Key Usage">
      <div className="flex flex-wrap gap-1.5">
        {ext.usages.map((oid, i) => (
          <Badge key={i} variant="secondary" className="text-[11px]">
            {resolveOid(String(oid))}
          </Badge>
        ))}
      </div>
    </Section>
  )
}

function BasicConstraintsSection({ ext }: { ext: BasicConstraintsExtension }) {
  return (
    <Section icon={Info} title="Basic Constraints">
      <div className="space-y-2">
        <InfoRow label="Certificate Authority" value={ext.ca ? "Yes" : "No"} />
        {ext.pathLength !== undefined && (
          <InfoRow label="Path Length" value={String(ext.pathLength)} />
        )}
        {ext.critical && (
          <p className="text-[10px] text-muted-foreground">
            This extension is marked as <span className="text-destructive font-medium">critical</span>.
          </p>
        )}
      </div>
    </Section>
  )
}

function CrlSection({ ext }: { ext: CRLDistributionPointsExtension }) {
  const urls: string[] = []
  try {
    for (const dp of ext.distributionPoints) {
      if (dp.distributionPoint?.fullName) {
        for (const gn of dp.distributionPoint.fullName) {
          // asn1-x509 GeneralName uses named fields
          if (gn.uniformResourceIdentifier) {
            urls.push(gn.uniformResourceIdentifier)
          } else if (gn.dNSName) {
            urls.push(gn.dNSName)
          }
        }
      }
    }
  } catch {
    // fallback
  }

  if (urls.length === 0) return null

  return (
    <Section icon={Link2} title="CRL Distribution Points">
      <div className="space-y-1.5">
        {urls.map((url, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-[11px] text-blue-400 break-all">
              {url}
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function AiaSection({ ext }: { ext: AuthorityInfoAccessExtension }) {
  const ocspUrls: string[] = []
  const caIssuers: string[] = []
  try {
    for (const gn of ext.ocsp) {
      if (typeof gn.value === "string") ocspUrls.push(gn.value)
    }
    for (const gn of ext.caIssuers) {
      if (typeof gn.value === "string") caIssuers.push(gn.value)
    }
  } catch {
    // fallback
  }

  if (ocspUrls.length === 0 && caIssuers.length === 0) return null

  return (
    <Section icon={BookOpen} title="Authority Information Access">
      <div className="space-y-2">
        {ocspUrls.map((url, i) => (
          <div key={`ocsp-${i}`} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
              OCSP
            </Badge>
            <span className="font-mono text-[11px] text-blue-400 break-all">{url}</span>
          </div>
        ))}
        {caIssuers.map((url, i) => (
          <div key={`ca-${i}`} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">
              CA Issuers
            </Badge>
            <span className="font-mono text-[11px] text-blue-400 break-all">{url}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

function PolicySection({ ext }: { ext: CertificatePolicyExtension }) {
  if (ext.policies.length === 0) return null
  return (
    <Section icon={Award} title={`Certificate Policies (${ext.policies.length})`}>
      <div className="space-y-1.5">
        {ext.policies.map((oid, i) => {
          const name = resolveOid(oid)
          const isKnown = name !== oid
          return (
            <div key={i} className="text-xs">
              {isKnown ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">{oid}</span>
                </div>
              ) : (
                <span className="font-mono">{oid}</span>
              )}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function OtherExtensionItem({
  ext,
}: {
  ext: { type: string; critical: boolean; value: ArrayBuffer }
}) {
  const [open, setOpen] = useState(false)
  const name = resolveOid(ext.type)
  const isKnown = name !== ext.type

  let valueDisplay: React.ReactNode = null
  try {
    const bytes = new Uint8Array(ext.value)
    const node = parseAsn1(bytes, 0)
    valueDisplay = <Asn1TreeView node={node} defaultExpanded={2} />
  } catch {
    valueDisplay = (
      <span className="font-mono text-[11px] text-muted-foreground break-all">
        {bytesToHex(new Uint8Array(ext.value))}
      </span>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs rounded-md border bg-muted/20 hover:bg-accent/30 transition-colors">
        <ChevronRight
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="font-medium flex-1 truncate">
          {isKnown ? name : ext.type}
        </span>
        {ext.critical && (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
            Critical
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-2 ml-5 mt-1 border-l-2 border-border/40">
          {isKnown && (
            <p className="text-[10px] text-muted-foreground font-mono mb-2">
              OID: {ext.type}
            </p>
          )}
          {valueDisplay}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Shared sub-components ──

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <Separator />
        {children}
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  mono,
  copy,
}: {
  label: string
  value: string
  mono?: boolean
  copy?: (text: string, label?: string) => Promise<void>
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 text-xs group">
      <span className="text-muted-foreground w-36 shrink-0 pt-0.5 text-right">
        {label}
      </span>
      <span
        className={`break-all flex-1 ${mono ? "font-mono text-[11px] leading-relaxed" : ""}`}
      >
        {value}
      </span>
      {copy && value && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => copy(value, `${label} copied`)}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function DnDisplay({ dn }: { dn: string }) {
  const parts = parseDN(dn)
  if (parts.length === 0)
    return <span className="text-xs text-muted-foreground">Empty</span>

  return (
    <div className="space-y-1.5">
      {parts.map(([key, value], i) => (
        <div key={i} className="flex items-start gap-3 text-xs">
          <span className="text-muted-foreground w-36 shrink-0 text-right">
            {DN_LABELS[key.toUpperCase()] || key}
          </span>
          <span className="break-all flex-1">{value}</span>
        </div>
      ))}
    </div>
  )
}

function PublicKeyDisplay({
  algorithm,
}: {
  algorithm: KeyAlgorithm & { modulusLength?: number; namedCurve?: string }
}) {
  const algoName = algorithm.name
  const keySize = algorithm.modulusLength
  const curve = algorithm.namedCurve

  return (
    <div className="space-y-2">
      <InfoRow label="Algorithm" value={algoName} />
      {keySize && <InfoRow label="Key Size" value={`${keySize} bit`} />}
      {curve && <InfoRow label="Curve" value={curve} />}
    </div>
  )
}

// ── Helpers ──

const DN_LABELS: Record<string, string> = {
  CN: "Common Name",
  O: "Organization",
  OU: "Organizational Unit",
  C: "Country",
  ST: "State / Province",
  L: "Locality",
  SN: "Surname",
  GN: "Given Name",
  E: "Email",
  SERIALNUMBER: "Serial Number",
  T: "Title",
  DC: "Domain Component",
  UID: "User ID",
  STREET: "Street Address",
  POSTALCODE: "Postal Code",
  "2.5.4.15": "Business Category",
  "1.3.6.1.4.1.311.60.2.1.3": "Jurisdiction Country",
  "1.3.6.1.4.1.311.60.2.1.2": "Jurisdiction State",
  "1.3.6.1.4.1.311.60.2.1.1": "Jurisdiction Locality",
}

function parseDN(dn: string): [string, string][] {
  if (!dn) return []
  const result: [string, string][] = []
  const parts = dn.split(/,\s*(?=[A-Z]+=|[a-z]+=|[0-9.]+[=#])/)
  for (const part of parts) {
    const eqIdx = part.indexOf("=")
    if (eqIdx > 0) {
      result.push([
        part.substring(0, eqIdx).trim(),
        part.substring(eqIdx + 1).trim(),
      ])
    }
  }
  return result
}

function extractCN(dn: string): string {
  const parts = parseDN(dn)
  const cn = parts.find(([k]) => k.toUpperCase() === "CN")
  return cn ? cn[1] : ""
}

function formatAlgorithm(algo: Algorithm & { hash?: Algorithm }): string {
  let name = algo.name
  if (algo.hash) name += ` / ${algo.hash.name}`
  return name
}

function formatSerial(hex: string): string {
  return hex.toLowerCase()
}

function formatFingerprint(hex: string): string {
  if (!hex) return ""
  return hex
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, "$1:")
}

function formatDate(d: Date): string {
  return `${d.toUTCString()} (${d.toLocaleDateString()})`
}
