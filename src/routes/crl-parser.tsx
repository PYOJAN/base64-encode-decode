import { useState, useEffect, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileX2,
  ClipboardPaste,
  Trash2,
  Upload,
  Binary,
  AlertTriangle,
  Clock,
  Shield,
  Award,
  Ban,
  Search,
  Copy,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { PageHeader } from "@/components/page-header"
import { Asn1TreeView } from "@/components/asn1-tree-view"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { inputToBytes, bytesToHex } from "@/utils/pem"
import {
  parseAsn1,
  type Asn1Node,
  decodeOid,
  decodeAsn1String,
  formatHex,
  formatUtcTime,
  formatGeneralizedTime,
} from "@/utils/asn1-parser"
import { resolveOid } from "@/utils/oids"

export const Route = createFileRoute("/crl-parser")({
  component: CrlParserPage,
})

// ── CRL Reason Codes (RFC 5280 5.3.1) ──

const CRL_REASONS: Record<number, string> = {
  0: "Unspecified",
  1: "Key Compromise",
  2: "CA Compromise",
  3: "Affiliation Changed",
  4: "Superseded",
  5: "Cessation of Operation",
  6: "Certificate Hold",
  8: "Remove from CRL",
  9: "Privilege Withdrawn",
  10: "AA Compromise",
}

// ── Types ──

interface RevokedCert {
  serialHex: string
  revocationDate: string
  reason: string | null
}

interface CrlInfo {
  issuer: string
  signatureAlgorithm: string
  thisUpdate: string
  nextUpdate: string | null
  revokedCertificates: RevokedCert[]
}

// ── ASN.1 walker helpers ──

function decodeTime(node: Asn1Node): string {
  if (node.tagClass === 0 && node.tagNumber === 0x17) {
    return formatUtcTime(node.value)
  }
  if (node.tagClass === 0 && node.tagNumber === 0x18) {
    return formatGeneralizedTime(node.value)
  }
  return formatHex(node.value)
}

function decodeIssuerDn(seqNode: Asn1Node): string {
  // seqNode is a SEQUENCE of SETs, each SET contains a SEQUENCE of (OID, value)
  if (!seqNode.children) return formatHex(seqNode.value)

  const parts: string[] = []
  for (const setNode of seqNode.children) {
    if (!setNode.children) continue
    for (const rdnSeq of setNode.children) {
      if (!rdnSeq.children || rdnSeq.children.length < 2) continue
      const oidNode = rdnSeq.children[0]!
      const valNode = rdnSeq.children[1]!
      const oid = decodeOid(oidNode.value)
      const name = resolveOid(oid)
      const value = decodeAsn1String(valNode)

      // Use short name if available
      const shortName = name.match(/\(([A-Z]+)\)/)?.[1]
      parts.push(`${shortName ?? name}=${value}`)
    }
  }
  return parts.join(", ") || formatHex(seqNode.value)
}

function extractSignatureAlgorithm(algSeq: Asn1Node): string {
  if (!algSeq.children || algSeq.children.length < 1) return "Unknown"
  const oidNode = algSeq.children[0]!
  const oid = decodeOid(oidNode.value)
  return resolveOid(oid)
}

function extractRevocationReason(extensions: Asn1Node): string | null {
  // Extensions is a SEQUENCE of SEQUENCE(OID, [BOOLEAN], OCTET STRING)
  if (!extensions.children) return null
  for (const extSeq of extensions.children) {
    if (!extSeq.children || extSeq.children.length < 2) continue
    const oid = decodeOid(extSeq.children[0]!.value)
    // CRL Reason Code OID: 2.5.29.21
    if (oid === "2.5.29.21") {
      // Value is OCTET STRING wrapping an ENUMERATED
      const valueNode = extSeq.children[extSeq.children.length - 1]!
      // Parse the inner OCTET STRING
      if (valueNode.children && valueNode.children.length > 0) {
        const enumNode = valueNode.children[0]!
        if (enumNode.value.length > 0) {
          const code = enumNode.value[0]!
          return CRL_REASONS[code] ?? `Unknown (${code})`
        }
      } else if (valueNode.value.length >= 3) {
        // Manually parse: ENUMERATED tag (0x0a) + length + value
        if (valueNode.value[0] === 0x0a && valueNode.value.length >= 3) {
          const code = valueNode.value[2]!
          return CRL_REASONS[code] ?? `Unknown (${code})`
        }
      }
    }
  }
  return null
}

function extractCrlInfo(root: Asn1Node): CrlInfo | null {
  // CRL structure:
  // SEQUENCE {
  //   SEQUENCE (tbsCertList) {
  //     INTEGER (version) -- optional, only v2
  //     SEQUENCE (signature algorithm)
  //     SEQUENCE (issuer)
  //     UTCTime/GeneralizedTime (thisUpdate)
  //     UTCTime/GeneralizedTime (nextUpdate) -- optional
  //     SEQUENCE (revokedCertificates) -- optional
  //     [0] EXPLICIT (extensions) -- optional
  //   }
  //   SEQUENCE (signature algorithm)
  //   BIT STRING (signature)
  // }

  if (!root.children || root.children.length < 2) return null

  const tbsCertList = root.children[0]!
  if (!tbsCertList.children) return null

  let idx = 0
  const children = tbsCertList.children

  // Version (optional - only present for v2 CRLs)
  let currentNode = children[idx]
  if (
    currentNode &&
    currentNode.tagClass === 0 &&
    currentNode.tagNumber === 0x02
  ) {
    // Version present, skip it
    idx++
  }

  // Signature Algorithm
  const sigAlgNode = children[idx]
  if (!sigAlgNode) return null
  const signatureAlgorithm = extractSignatureAlgorithm(sigAlgNode)
  idx++

  // Issuer
  const issuerNode = children[idx]
  if (!issuerNode) return null
  const issuer = decodeIssuerDn(issuerNode)
  idx++

  // This Update
  const thisUpdateNode = children[idx]
  if (!thisUpdateNode) return null
  const thisUpdate = decodeTime(thisUpdateNode)
  idx++

  // Next Update (optional -- could be a time or a SEQUENCE of revoked certs)
  let nextUpdate: string | null = null
  const nextNode = children[idx]
  if (
    nextNode &&
    nextNode.tagClass === 0 &&
    (nextNode.tagNumber === 0x17 || nextNode.tagNumber === 0x18)
  ) {
    nextUpdate = decodeTime(nextNode)
    idx++
  }

  // Revoked Certificates (optional SEQUENCE)
  const revokedCertificates: RevokedCert[] = []
  const revokedSeq = children[idx]
  if (
    revokedSeq &&
    revokedSeq.tagClass === 0 &&
    revokedSeq.tagNumber === 0x10 &&
    revokedSeq.children
  ) {
    for (const entry of revokedSeq.children) {
      if (!entry.children || entry.children.length < 2) continue

      // Serial number (INTEGER)
      const serialNode = entry.children[0]!
      const serialHex = Array.from(serialNode.value)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // Revocation date
      const dateNode = entry.children[1]!
      const revocationDate = decodeTime(dateNode)

      // Reason (optional extensions, index 2)
      let reason: string | null = null
      if (entry.children.length > 2) {
        const extNode = entry.children[2]!
        reason = extractRevocationReason(extNode)
      }

      revokedCertificates.push({ serialHex, revocationDate, reason })
    }
  }

  return {
    issuer,
    signatureAlgorithm,
    thisUpdate,
    nextUpdate,
    revokedCertificates,
  }
}

// ── Page ──

function CrlParserPage() {
  const [input, setInput] = useState("")
  const [parsed, setParsed] = useState<Asn1Node | null>(null)
  const [crlInfo, setCrlInfo] = useState<CrlInfo | null>(null)
  const [error, setError] = useState("")
  const [searchSerial, setSearchSerial] = useState("")
  const { paste, copy } = useClipboard()

  const debounced = useDebounce(input, 300)

  // Filter revoked certs by serial number search
  const filteredRevoked = useMemo(() => {
    if (!crlInfo) return []
    const q = searchSerial.trim().toLowerCase().replace(/[:\s]/g, "")
    if (!q) return crlInfo.revokedCertificates
    return crlInfo.revokedCertificates.filter((cert) =>
      cert.serialHex.includes(q)
    )
  }, [crlInfo, searchSerial])

  const searchMatch = searchSerial.trim() !== "" ? filteredRevoked.length > 0 : null

  useEffect(() => {
    if (!debounced.trim()) {
      setParsed(null)
      setCrlInfo(null)
      setError("")
      return
    }
    try {
      const bytes = inputToBytes(debounced)
      if (!bytes) {
        setError(
          "Unable to parse input. Provide PEM, Base64, or hex-encoded DER data."
        )
        setParsed(null)
        setCrlInfo(null)
        return
      }
      const root = parseAsn1(bytes, 0)
      setParsed(root)
      const info = extractCrlInfo(root)
      setCrlInfo(info)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse CRL")
      setParsed(null)
      setCrlInfo(null)
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

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={FileX2}
        title="CRL Parser"
        description="Parse and inspect X.509 Certificate Revocation Lists. All processing happens locally in your browser."
        badge="Certificate / Signing"
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
                Upload
                <input
                  type="file"
                  className="hidden"
                  accept=".crl,.pem,.der"
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
            placeholder={`-----BEGIN X509 CRL-----\nMIIC...\n-----END X509 CRL-----`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="resize-none font-mono text-xs leading-relaxed"
          />
          {error && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Output */}
      {parsed && (
        <Tabs defaultValue="details">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="asn1">
              <Binary className="mr-1.5 h-3.5 w-3.5" />
              ASN.1 Tree
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {crlInfo ? (
              <>
                {/* Issuer */}
                <Section icon={Award} title="Issuer">
                  <p className="text-xs font-mono break-all leading-relaxed">
                    {crlInfo.issuer}
                  </p>
                </Section>

                {/* Signature Algorithm */}
                <Section icon={Shield} title="Signature Algorithm">
                  <InfoRow
                    label="Algorithm"
                    value={crlInfo.signatureAlgorithm}
                  />
                </Section>

                {/* Validity Dates */}
                <Section icon={Clock} title="Validity Dates">
                  <div className="space-y-2">
                    <InfoRow label="This Update" value={crlInfo.thisUpdate} />
                    <InfoRow
                      label="Next Update"
                      value={crlInfo.nextUpdate ?? "Not specified"}
                    />
                  </div>
                </Section>

                {/* Revoked Certificates */}
                <Section
                  icon={Ban}
                  title={`Revoked Certificates (${crlInfo.revokedCertificates.length})`}
                >
                  {crlInfo.revokedCertificates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No revoked certificates in this CRL.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {/* Search by serial number */}
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search by serial number (e.g. 0A:1B:2C or 0A1B2C)..."
                            value={searchSerial}
                            onChange={(e) => setSearchSerial(e.target.value)}
                            className="h-8 pl-8 text-xs font-mono"
                          />
                        </div>
                        {searchMatch === true && (
                          <p className="text-xs text-destructive flex items-center gap-1.5">
                            <Ban className="h-3.5 w-3.5 shrink-0" />
                            Certificate is <strong>REVOKED</strong> — {filteredRevoked.length} match{filteredRevoked.length > 1 ? "es" : ""} found
                          </p>
                        )}
                        {searchMatch === false && (
                          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            Certificate serial not found in this CRL
                          </p>
                        )}
                      </div>

                      <ScrollArea className="max-h-96">
                        <div className="space-y-2">
                          {filteredRevoked.map((cert, i) => (
                            <div
                              key={i}
                              className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-1.5"
                            >
                              <div className="flex items-start gap-3 text-xs group">
                                <span className="text-muted-foreground w-28 shrink-0 text-right">
                                  Serial Number
                                </span>
                                <span className="font-mono text-[11px] break-all flex-1">
                                  {cert.serialHex}
                                </span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => copy(cert.serialHex, "Serial copied")}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    >
                                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copy</TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="flex items-start gap-3 text-xs">
                                <span className="text-muted-foreground w-28 shrink-0 text-right">
                                  Revoked On
                                </span>
                                <span className="text-[11px] flex-1">
                                  {cert.revocationDate}
                                </span>
                              </div>
                              {cert.reason && (
                                <div className="flex items-start gap-3 text-xs">
                                  <span className="text-muted-foreground w-28 shrink-0 text-right">
                                    Reason
                                  </span>
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px]"
                                  >
                                    {cert.reason}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ))}
                          {searchSerial.trim() && filteredRevoked.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              No matching revoked certificates.
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </Section>
              </>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <p className="text-sm text-muted-foreground">
                    Parsed ASN.1 structure, but could not extract CRL fields.
                    Check the ASN.1 Tree tab for raw structure.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="asn1">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="rounded-md border bg-muted/20 p-3 overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <Asn1TreeView node={parsed} defaultExpanded={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
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
}: {
  label: string
  value: string
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="text-muted-foreground w-36 shrink-0 pt-0.5 text-right">
        {label}
      </span>
      <span className="break-all flex-1">{value}</span>
    </div>
  )
}
