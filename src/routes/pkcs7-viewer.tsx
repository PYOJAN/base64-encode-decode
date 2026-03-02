import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileArchive,
  ClipboardPaste,
  Trash2,
  Upload,
  Binary,
  FileDigit,
  AlertTriangle,
  Award,
  Users,
  Info,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Clock,
  Key,
  Fingerprint,
  Puzzle,
  Globe,
  ChevronRight,
  Link2,
  BookOpen,
  Copy,
  Loader,
} from "lucide-react"
import {
  X509Certificate,
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { PageHeader } from "@/components/page-header"
import { Asn1TreeView } from "@/components/asn1-tree-view"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { inputToBytes, bytesToHex, fingerprint } from "@/utils/pem"
import {
  parseAsn1,
  type Asn1Node,
  decodeOid,
} from "@/utils/asn1-parser"
import { resolveOid } from "@/utils/oids"

export const Route = createFileRoute("/pkcs7-viewer")({
  component: Pkcs7ViewerPage,
})

// ── Types ──

interface Pkcs7Info {
  contentTypeOid: string
  contentTypeName: string
  version: number | null
  certificateCount: number
  signerCount: number
  digestAlgorithms: string[]
}

// ── Helpers to walk ASN.1 tree ──

function getChildSequence(node: Asn1Node, index: number): Asn1Node | null {
  if (!node.children || index >= node.children.length) return null
  return node.children[index] ?? null
}

function findContextTag(node: Asn1Node, tagNumber: number): Asn1Node | null {
  if (!node.children) return null
  return (
    node.children.find(
      (c) => c.tagClass === 2 && c.tagNumber === tagNumber
    ) ?? null
  )
}

function extractOid(node: Asn1Node): string | null {
  if (node.tagClass === 0 && node.tagNumber === 0x06) {
    return decodeOid(node.value)
  }
  return null
}

function extractInteger(node: Asn1Node): number | null {
  if (node.tagClass === 0 && node.tagNumber === 0x02 && node.value.length <= 4) {
    let val = 0
    for (const b of node.value) val = (val << 8) | b
    return val
  }
  return null
}

function countSequenceChildren(node: Asn1Node | null): number {
  if (!node || !node.children) return 0
  return node.children.length
}

function extractPkcs7Info(root: Asn1Node): Pkcs7Info | null {
  // PKCS#7 structure:
  // SEQUENCE {
  //   OID (contentType)
  //   [0] EXPLICIT {
  //     SEQUENCE (signedData) {
  //       INTEGER (version)
  //       SET (digestAlgorithms)
  //       SEQUENCE (contentInfo)
  //       [0] IMPLICIT (certificates) -- optional
  //       [1] IMPLICIT (crls) -- optional
  //       SET (signerInfos)
  //     }
  //   }
  // }

  if (!root.children || root.children.length < 2) return null

  const contentTypeNode = root.children[0]
  if (!contentTypeNode) return null
  const contentTypeOid = extractOid(contentTypeNode)
  if (!contentTypeOid) return null
  const contentTypeName = resolveOid(contentTypeOid)

  const context0 = findContextTag(root, 0)
  if (!context0 || !context0.children || context0.children.length < 1) {
    return {
      contentTypeOid,
      contentTypeName,
      version: null,
      certificateCount: 0,
      signerCount: 0,
      digestAlgorithms: [],
    }
  }

  const signedData = context0.children[0]
  if (!signedData || !signedData.children) {
    return {
      contentTypeOid,
      contentTypeName,
      version: null,
      certificateCount: 0,
      signerCount: 0,
      digestAlgorithms: [],
    }
  }

  // Version
  const versionNode = getChildSequence(signedData, 0)
  const version = versionNode ? extractInteger(versionNode) : null

  // Digest algorithms (SET at index 1)
  const digestAlgSet = getChildSequence(signedData, 1)
  const digestAlgorithms: string[] = []
  if (digestAlgSet?.children) {
    for (const algSeq of digestAlgSet.children) {
      if (algSeq.children && algSeq.children[0]) {
        const oid = extractOid(algSeq.children[0])
        if (oid) digestAlgorithms.push(resolveOid(oid))
      }
    }
  }

  // Certificates -- context tag [0]
  const certsNode = findContextTag(signedData, 0)
  const certificateCount = countSequenceChildren(certsNode)

  // Signer infos -- last SET in signedData
  let signerCount = 0
  if (signedData.children.length > 0) {
    const lastChild = signedData.children[signedData.children.length - 1]
    if (
      lastChild &&
      lastChild.tagClass === 0 &&
      lastChild.tagNumber === 0x11
    ) {
      signerCount = countSequenceChildren(lastChild)
    }
  }

  return {
    contentTypeOid,
    contentTypeName,
    version,
    certificateCount,
    signerCount,
    digestAlgorithms,
  }
}

// ── Extract raw DER bytes for each embedded certificate ──

function extractCertBytes(root: Asn1Node, rawBytes: Uint8Array): Uint8Array[] {
  if (!root.children || root.children.length < 2) return []
  const context0 = findContextTag(root, 0)
  if (!context0?.children?.[0]) return []
  const signedData = context0.children[0]
  if (!signedData?.children) return []
  const certsNode = findContextTag(signedData, 0)
  if (!certsNode?.children) return []
  return certsNode.children.map((child) =>
    rawBytes.slice(child.offset, child.offset + child.totalLen)
  )
}

// ── Parsed certificate with fingerprints ──

interface ParsedCert {
  cert: X509Certificate
  sha256: string
  sha1: string
}

// ── Key usage flag map ──

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

// ── DN label map ──

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
}

// ── Page ──

function Pkcs7ViewerPage() {
  const [input, setInput] = useState("")
  const [parsed, setParsed] = useState<Asn1Node | null>(null)
  const [info, setInfo] = useState<Pkcs7Info | null>(null)
  const [certs, setCerts] = useState<ParsedCert[]>([])
  const [error, setError] = useState("")
  const { paste, copy, isCopying, isPasting } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setParsed(null)
      setInfo(null)
      setCerts([])
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
        setInfo(null)
        setCerts([])
        return
      }
      const root = parseAsn1(bytes, 0)
      setParsed(root)
      const extracted = extractPkcs7Info(root)
      setInfo(extracted)
      setError("")

      // Parse embedded certificates
      const certDerList = extractCertBytes(root, bytes)
      const parsedCerts: ParsedCert[] = []
      for (const der of certDerList) {
        try {
          const cert = new X509Certificate(der.buffer as ArrayBuffer)
          parsedCerts.push({ cert, sha256: "", sha1: "" })
        } catch { /* skip unparseable certs */ }
      }
      setCerts(parsedCerts)

      // Compute fingerprints asynchronously
      for (let i = 0; i < certDerList.length; i++) {
        const idx = i
        const der = certDerList[i]!
        fingerprint(der, "SHA-256").then((h) =>
          setCerts((prev) => prev.map((c, j) => j === idx ? { ...c, sha256: h } : c))
        )
        fingerprint(der, "SHA-1").then((h) =>
          setCerts((prev) => prev.map((c, j) => j === idx ? { ...c, sha1: h } : c))
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse PKCS#7 data")
      setParsed(null)
      setInfo(null)
      setCerts([])
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
        icon={FileArchive}
        title="PKCS#7 Viewer"
        description="Parse and inspect PKCS#7 / CMS signed-data structures. All processing happens locally in your browser."
        badge="Certificate / Signing"
      />

      {/* Input */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              {isPasting ? <Loader className="animate-spin mr-1.5 h-3.5 w-3.5" /> : <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />}
              Paste
            </Button>
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Upload
                <input
                  type="file"
                  className="hidden"
                  accept=".p7b,.p7c,.pem,.der,.cer"
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
            placeholder={`-----BEGIN PKCS7-----\nMIIC...\n-----END PKCS7-----`}
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
            {certs.length > 0 && (
              <TabsTrigger value="certificates">
                <Award className="mr-1.5 h-3.5 w-3.5" />
                Certificates ({certs.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="asn1">
              <Binary className="mr-1.5 h-3.5 w-3.5" />
              ASN.1 Tree
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {info ? (
              <>
                {/* Content Type */}
                <Section icon={FileDigit} title="Content Type">
                  <div className="space-y-2">
                    <InfoRow label="OID" value={info.contentTypeOid} mono />
                    <InfoRow label="Name" value={info.contentTypeName} />
                    {info.contentTypeOid === "1.2.840.113549.1.7.2" && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] mt-1"
                      >
                        Signed Data
                      </Badge>
                    )}
                  </div>
                </Section>

                {/* Version */}
                {info.version !== null && (
                  <Section icon={Info} title="Version">
                    <InfoRow
                      label="Version"
                      value={String(info.version)}
                    />
                  </Section>
                )}

                {/* Digest Algorithms */}
                {info.digestAlgorithms.length > 0 && (
                  <Section icon={Award} title="Digest Algorithms">
                    <div className="flex flex-wrap gap-1.5">
                      {info.digestAlgorithms.map((alg, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[11px]"
                        >
                          {alg}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Certificates */}
                <Section icon={Award} title={`Certificates (${info.certificateCount})`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className="text-sm font-mono"
                    >
                      {info.certificateCount}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      certificate{info.certificateCount !== 1 ? "s" : ""}{" "}
                      found in the bundle
                    </span>
                  </div>
                  {certs.length > 0 && (
                    <div className="space-y-3">
                      {certs.map((pc, idx) => (
                        <InlineCertCard key={idx} pc={pc} index={idx} />
                      ))}
                    </div>
                  )}
                </Section>

                {/* Signers */}
                <Section icon={Users} title="Signers">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-sm font-mono"
                    >
                      {info.signerCount}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      signer{info.signerCount !== 1 ? "s" : ""} present
                    </span>
                  </div>
                </Section>
              </>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <p className="text-sm text-muted-foreground">
                    Parsed ASN.1 structure, but could not extract PKCS#7
                    signed-data fields. Check the ASN.1 Tree tab for raw
                    structure.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Certificates Tab ── */}
          {certs.length > 0 && (
            <TabsContent value="certificates" className="space-y-4">
              {certs.map((pc, idx) => (
                <CertificateCard key={idx} pc={pc} index={idx} />
              ))}
            </TabsContent>
          )}

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

// ── Certificate Card (full details for one cert) ──

function CertificateCard({
  pc,
  index,
}: {
  pc: ParsedCert
  index: number
}) {
  const [open, setOpen] = useState(index === 0) // expand first by default
  const { cert, sha256, sha1 } = pc

  const now = new Date()
  const notBefore = cert.notBefore
  const notAfter = cert.notAfter
  const isExpired = now > notAfter
  const isNotYetValid = now < notBefore
  const isValid = !isExpired && !isNotYetValid
  const isSelfSigned = cert.subject === cert.issuer
  const subjectCN = extractCN(cert.subject)
  const daysLeft = Math.ceil((notAfter.getTime() - now.getTime()) / 86400000)
  const totalDays = Math.ceil((notAfter.getTime() - notBefore.getTime()) / 86400000)
  const elapsedDays = Math.ceil((now.getTime() - notBefore.getTime()) / 86400000)
  const progressPct = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100))

  const basicConstraints = cert.getExtension(BasicConstraintsExtension)
  const keyUsage = cert.getExtension(KeyUsagesExtension)
  const extKeyUsage = cert.getExtension(ExtendedKeyUsageExtension)
  const san = cert.getExtension(SubjectAlternativeNameExtension)
  const ski = cert.getExtension(SubjectKeyIdentifierExtension)
  const aki = cert.getExtension(AuthorityKeyIdentifierExtension)
  const crlDist = cert.getExtension(CRLDistributionPointsExtension)
  const aia = cert.getExtension(AuthorityInfoAccessExtension)
  const certPolicy = cert.getExtension(CertificatePolicyExtension)
  const knownOids = new Set([
    "2.5.29.19", "2.5.29.15", "2.5.29.37", "2.5.29.17",
    "2.5.29.14", "2.5.29.35", "2.5.29.31", "1.3.6.1.5.5.7.1.1",
    "2.5.29.32",
  ])
  const otherExtensions = cert.extensions.filter((e) => !knownOids.has(e.type))

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={isValid ? "border-emerald-500/20" : isExpired ? "border-destructive/20" : "border-amber-500/20"}>
        <CollapsibleTrigger className="w-full text-left">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
              {isValid ? (
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : isExpired ? (
                <ShieldX className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] font-mono shrink-0">#{index + 1}</Badge>
                  <p className="text-sm font-semibold truncate">{subjectCN || cert.subject}</p>
                  {isSelfSigned && <Badge variant="outline" className="text-[10px] shrink-0">Self-Signed</Badge>}
                  {basicConstraints?.ca && <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-400/30 shrink-0">CA</Badge>}
                  <Badge variant={isValid ? "secondary" : "destructive"} className="text-[10px] shrink-0">
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
                  {formatAlgorithm(cert.signatureAlgorithm)}
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-4">
            <Separator />

            {/* Validity progress */}
            {!isNotYetValid && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isExpired ? "bg-destructive" : progressPct > 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{notBefore.toLocaleDateString()}</span>
                  <span>{notAfter.toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Certificate Details */}
            <Section icon={FileDigit} title="Certificate Details">
              <div className="space-y-2">
                <InfoRow label="Serial Number" value={formatSerial(cert.serialNumber)} mono />
                <InfoRow label="Signature Algorithm" value={formatAlgorithm(cert.signatureAlgorithm)} />
                <InfoRow label="DER Size" value={`${(cert.rawData as ArrayBuffer).byteLength} bytes`} />
              </div>
            </Section>

            {/* Subject */}
            <Section icon={ShieldCheck} title="Subject">
              <DnDisplay dn={cert.subject} />
            </Section>

            {/* Issuer */}
            <Section icon={Award} title="Issuer">
              <DnDisplay dn={cert.issuer} />
            </Section>

            {/* Validity */}
            <Section icon={Clock} title="Validity Period">
              <div className="space-y-2">
                <InfoRow label="Not Before" value={formatDate(notBefore)} />
                <InfoRow label="Not After" value={formatDate(notAfter)} />
                <InfoRow label="Duration" value={`${totalDays} days`} />
              </div>
            </Section>

            {/* Public Key */}
            <Section icon={Key} title="Public Key Info">
              <PublicKeyDisplay algorithm={cert.publicKey.algorithm as KeyAlgorithm & { modulusLength?: number; namedCurve?: string }} />
            </Section>

            {/* SAN */}
            {san && <SanSection san={san} />}

            {/* Key Usage */}
            {keyUsage && <KeyUsageSection ext={keyUsage} />}

            {/* Extended Key Usage */}
            {extKeyUsage && <ExtKeyUsageSection ext={extKeyUsage} />}

            {/* Basic Constraints */}
            {basicConstraints && <BasicConstraintsSection ext={basicConstraints} />}

            {/* Key Identifiers */}
            {(ski || aki) && (
              <Section icon={Key} title="Key Identifiers">
                <div className="space-y-2">
                  {ski && <InfoRow label="Subject Key ID" value={ski.keyId} mono />}
                  {aki?.keyId && <InfoRow label="Authority Key ID" value={aki.keyId} mono />}
                </div>
              </Section>
            )}

            {/* CRL Distribution Points */}
            {crlDist && <CrlDistSection ext={crlDist} />}

            {/* AIA */}
            {aia && <AiaSection ext={aia} />}

            {/* Certificate Policies */}
            {certPolicy && <PolicySection ext={certPolicy} />}

            {/* Other Extensions */}
            {otherExtensions.length > 0 && (
              <Section icon={Puzzle} title={`Other Extensions (${otherExtensions.length})`}>
                <div className="space-y-2">
                  {otherExtensions.map((ext, i) => (
                    <OtherExtensionItem key={i} ext={ext} />
                  ))}
                </div>
              </Section>
            )}

            {/* Fingerprints */}
            <Section icon={Fingerprint} title="Fingerprints">
              <div className="space-y-2">
                <InfoRow label="SHA-256" value={formatFingerprint(sha256)} mono />
                <InfoRow label="SHA-1" value={formatFingerprint(sha1)} mono />
              </div>
            </Section>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Inline Certificate Card (compact, for Details tab) ──

function InlineCertCard({
  pc,
  index,
}: {
  pc: ParsedCert
  index: number
}) {
  const [open, setOpen] = useState(false)
  const { cert, sha256, sha1 } = pc

  const now = new Date()
  const notBefore = cert.notBefore
  const notAfter = cert.notAfter
  const isExpired = now > notAfter
  const isNotYetValid = now < notBefore
  const isValid = !isExpired && !isNotYetValid
  const isSelfSigned = cert.subject === cert.issuer
  const subjectCN = extractCN(cert.subject)
  const daysLeft = Math.ceil((notAfter.getTime() - now.getTime()) / 86400000)

  const basicConstraints = cert.getExtension(BasicConstraintsExtension)
  const keyUsage = cert.getExtension(KeyUsagesExtension)
  const extKeyUsage = cert.getExtension(ExtendedKeyUsageExtension)
  const san = cert.getExtension(SubjectAlternativeNameExtension)
  const ski = cert.getExtension(SubjectKeyIdentifierExtension)
  const aki = cert.getExtension(AuthorityKeyIdentifierExtension)

  const keyUsageNames: string[] = []
  if (keyUsage) {
    for (const [flag, name] of KEY_USAGE_MAP) {
      if (keyUsage.usages & flag) keyUsageNames.push(name)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-md border ${isValid ? "border-emerald-500/20" : isExpired ? "border-destructive/20" : "border-amber-500/20"}`}>
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-start gap-3 p-3">
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
            {isValid ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            ) : isExpired ? (
              <ShieldX className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 shrink-0">#{index + 1}</Badge>
                <span className="text-xs font-semibold truncate">{subjectCN || cert.subject}</span>
                {isSelfSigned && <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">Self-Signed</Badge>}
                {basicConstraints?.ca && <Badge variant="outline" className="text-[9px] text-violet-400 border-violet-400/30 px-1 py-0 shrink-0">CA</Badge>}
                <Badge variant={isValid ? "secondary" : "destructive"} className="text-[9px] px-1 py-0 shrink-0">
                  {isValid ? "Valid" : isExpired ? "Expired" : "Not Yet Valid"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isValid
                  ? `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
                  : isExpired
                    ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""} ago`
                    : `Valid from ${notBefore.toLocaleDateString()}`}
                {" · "}
                {formatAlgorithm(cert.signatureAlgorithm)}
              </p>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2.5">
            <Separator />

            {/* Serial Number */}
            <div className="space-y-1.5">
              <InfoRow label="Serial Number" value={formatSerial(cert.serialNumber)} mono />
              <InfoRow label="Signature" value={formatAlgorithm(cert.signatureAlgorithm)} />
              <InfoRow label="DER Size" value={`${(cert.rawData as ArrayBuffer).byteLength} bytes`} />
            </div>

            {/* Subject */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Subject</p>
              <DnDisplay dn={cert.subject} />
            </div>

            {/* Issuer */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Issuer</p>
              <DnDisplay dn={cert.issuer} />
            </div>

            {/* Validity */}
            <div className="space-y-1.5">
              <InfoRow label="Not Before" value={formatDate(notBefore)} />
              <InfoRow label="Not After" value={formatDate(notAfter)} />
            </div>

            {/* Public Key */}
            <div className="space-y-1.5">
              <InfoRow label="Key Algorithm" value={(cert.publicKey.algorithm as { name: string }).name} />
              {(cert.publicKey.algorithm as unknown as { modulusLength?: number }).modulusLength && (
                <InfoRow label="Key Size" value={`${(cert.publicKey.algorithm as unknown as { modulusLength: number }).modulusLength} bit`} />
              )}
            </div>

            {/* SAN */}
            {san && (() => {
              const names: { type: string; value: string }[] = []
              try {
                for (const gn of san.names.items) {
                  if (gn.type === "dns") names.push({ type: "DNS", value: gn.value })
                  else if (gn.type === "ip") names.push({ type: "IP", value: gn.value })
                  else if (gn.type === "email") names.push({ type: "Email", value: gn.value })
                  else names.push({ type: gn.type, value: String(gn.value) })
                }
              } catch { /* */ }
              if (names.length === 0) return null
              return (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Subject Alternative Names ({names.length})</p>
                  <div className="space-y-1">
                    {names.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 shrink-0">{n.type}</Badge>
                        <span className="font-mono text-[11px] break-all">{n.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Key Usage */}
            {keyUsageNames.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Key Usage</p>
                <div className="flex flex-wrap gap-1">
                  {keyUsageNames.map((name) => (
                    <Badge key={name} variant="secondary" className="text-[10px]">{name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Extended Key Usage */}
            {extKeyUsage && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">Extended Key Usage</p>
                <div className="flex flex-wrap gap-1">
                  {extKeyUsage.usages.map((oid, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{resolveOid(String(oid))}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Key Identifiers */}
            {(ski || aki) && (
              <div className="space-y-1.5">
                {ski && <InfoRow label="Subject Key ID" value={ski.keyId} mono />}
                {aki?.keyId && <InfoRow label="Authority Key ID" value={aki.keyId} mono />}
              </div>
            )}

            {/* Fingerprints */}
            <div className="space-y-1.5">
              <InfoRow label="SHA-256" value={formatFingerprint(sha256)} mono />
              <InfoRow label="SHA-1" value={formatFingerprint(sha1)} mono />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ── Extension Section Components ──

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
  } catch { /* fallback */ }
  if (names.length === 0) return null
  return (
    <Section icon={Globe} title={`Subject Alternative Names (${names.length})`}>
      <div className="space-y-1.5">
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">{n.type}</Badge>
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
            <Badge key={name} variant="secondary" className="text-[11px]">{name}</Badge>
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
          <Badge key={i} variant="secondary" className="text-[11px]">{resolveOid(String(oid))}</Badge>
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
        {ext.pathLength !== undefined && <InfoRow label="Path Length" value={String(ext.pathLength)} />}
        {ext.critical && (
          <p className="text-[10px] text-muted-foreground">
            This extension is marked as <span className="text-destructive font-medium">critical</span>.
          </p>
        )}
      </div>
    </Section>
  )
}

function CrlDistSection({ ext }: { ext: CRLDistributionPointsExtension }) {
  const urls: string[] = []
  try {
    for (const dp of ext.distributionPoints) {
      if (dp.distributionPoint?.fullName) {
        for (const gn of dp.distributionPoint.fullName) {
          if (gn.uniformResourceIdentifier) urls.push(gn.uniformResourceIdentifier)
          else if (gn.dNSName) urls.push(gn.dNSName)
        }
      }
    }
  } catch { /* fallback */ }
  if (urls.length === 0) return null
  return (
    <Section icon={Link2} title="CRL Distribution Points">
      <div className="space-y-1.5">
        {urls.map((url, i) => (
          <div key={i} className="text-xs">
            <span className="font-mono text-[11px] text-blue-400 break-all">{url}</span>
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
    for (const gn of ext.ocsp) { if (typeof gn.value === "string") ocspUrls.push(gn.value) }
    for (const gn of ext.caIssuers) { if (typeof gn.value === "string") caIssuers.push(gn.value) }
  } catch { /* fallback */ }
  if (ocspUrls.length === 0 && caIssuers.length === 0) return null
  return (
    <Section icon={BookOpen} title="Authority Information Access">
      <div className="space-y-2">
        {ocspUrls.map((url, i) => (
          <div key={`ocsp-${i}`} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">OCSP</Badge>
            <span className="font-mono text-[11px] text-blue-400 break-all">{url}</span>
          </div>
        ))}
        {caIssuers.map((url, i) => (
          <div key={`ca-${i}`} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0">CA Issuers</Badge>
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

function OtherExtensionItem({ ext }: { ext: { type: string; critical: boolean; value: ArrayBuffer } }) {
  const [extOpen, setExtOpen] = useState(false)
  const name = resolveOid(ext.type)
  const isKnown = name !== ext.type
  let valueDisplay: React.ReactNode = null
  try {
    const bytes = new Uint8Array(ext.value)
    const node = parseAsn1(bytes, 0)
    valueDisplay = <Asn1TreeView node={node} defaultExpanded={2} />
  } catch {
    valueDisplay = <span className="font-mono text-[11px] text-muted-foreground break-all">{bytesToHex(new Uint8Array(ext.value))}</span>
  }
  return (
    <Collapsible open={extOpen} onOpenChange={setExtOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs rounded-md border bg-muted/20 hover:bg-accent/30 transition-colors">
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${extOpen ? "rotate-90" : ""}`} />
        <span className="font-medium flex-1 truncate">{isKnown ? name : ext.type}</span>
        {ext.critical && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Critical</Badge>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 py-2 ml-5 mt-1 border-l-2 border-border/40">
          {isKnown && <p className="text-[10px] text-muted-foreground font-mono mb-2">OID: {ext.type}</p>}
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
}: {
  label: string
  value: string
  mono?: boolean
}) {

  const { copy, isCopying } = useClipboard()

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
              {isCopying ? (
                <Loader className="h-3 w-3 text-muted-foreground animate-pulse" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              )}
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

function PublicKeyDisplay({ algorithm }: { algorithm: KeyAlgorithm & { modulusLength?: number; namedCurve?: string } }) {
  return (
    <div className="space-y-2">
      <InfoRow label="Algorithm" value={algorithm.name} />
      {algorithm.modulusLength && <InfoRow label="Key Size" value={`${algorithm.modulusLength} bit`} />}
      {algorithm.namedCurve && <InfoRow label="Curve" value={algorithm.namedCurve} />}
    </div>
  )
}

// ── Helpers ──

function parseDN(dn: string): [string, string][] {
  if (!dn) return []
  const result: [string, string][] = []
  const parts = dn.split(/,\s*(?=[A-Z]+=|[a-z]+=|[0-9.]+[=#])/)
  for (const part of parts) {
    const eqIdx = part.indexOf("=")
    if (eqIdx > 0) result.push([part.substring(0, eqIdx).trim(), part.substring(eqIdx + 1).trim()])
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
  return hex.toUpperCase().replace(/(.{2})(?=.)/g, "$1:")
}

function formatDate(d: Date): string {
  return `${d.toUTCString()} (${d.toLocaleDateString()})`
}
