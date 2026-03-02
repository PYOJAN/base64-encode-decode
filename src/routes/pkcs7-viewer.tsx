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
  ChevronRight,
  Loader,
  Eye,
} from "lucide-react"
import {
  X509Certificate,
  BasicConstraintsExtension,
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
import { Asn1TreeView } from "@/components/asn1-tree-view"
import { ToolPageLayout, SectionCard, InfoRow } from "@/components"
import { CertDetailsContent } from "@/components/cert-display"
import { CertDetailDialog } from "@/components/cert-detail-dialog"
import { useClipboard, useDebounce } from "@/hooks"
import { inputToBytes, bytesToHex, fingerprint } from "@/utils/pem"
import {
  parseAsn1,
  type Asn1Node,
  decodeOid,
  decodeAsn1String,
} from "@/utils/asn1-parser"
import { resolveOid } from "@/utils/oids"
import {
  formatAlgorithm,
  formatSerial,
  extractCN,
} from "@/utils/cert-helpers"

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

interface ParsedCert {
  cert: X509Certificate
  sha256: string
  sha1: string
}

interface SignerInfoParsed {
  version: number | null
  issuerDN: string
  serialHex: string
  digestAlgorithm: string
  signatureAlgorithm: string
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

  const versionNode = getChildSequence(signedData, 0)
  const version = versionNode ? extractInteger(versionNode) : null

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

  const certsNode = findContextTag(signedData, 0)
  const certificateCount = countSequenceChildren(certsNode)

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

// ── Extract SignerInfos from ASN.1 ──

function decodeDNFromAsn1(nameNode: Asn1Node): string {
  // Name ::= SEQUENCE OF RelativeDistinguishedName
  // RDN  ::= SET OF AttributeTypeAndValue
  // ATV  ::= SEQUENCE { type OID, value ANY }
  const parts: string[] = []
  if (!nameNode.children) return ""
  for (const rdn of nameNode.children) {
    if (!rdn.children) continue
    for (const atv of rdn.children) {
      if (!atv.children || atv.children.length < 2) continue
      const oidNode = atv.children[0]!
      const valNode = atv.children[1]!
      const oid = extractOid(oidNode)
      if (!oid) continue
      const label = resolveOid(oid)
      const value = decodeAsn1String(valNode)
      parts.push(`${label}=${value}`)
    }
  }
  return parts.join(", ")
}

function extractIntegerHex(node: Asn1Node): string {
  if (node.tagClass === 0 && node.tagNumber === 0x02) {
    return Array.from(node.value)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }
  return ""
}

function extractSignerInfos(root: Asn1Node): SignerInfoParsed[] {
  if (!root.children || root.children.length < 2) return []
  const context0 = findContextTag(root, 0)
  if (!context0?.children?.[0]) return []
  const signedData = context0.children[0]
  if (!signedData?.children || signedData.children.length === 0) return []

  // SignerInfos is the last child SET
  const lastChild = signedData.children[signedData.children.length - 1]
  if (
    !lastChild ||
    lastChild.tagClass !== 0 ||
    lastChild.tagNumber !== 0x11 ||
    !lastChild.children
  )
    return []

  const signers: SignerInfoParsed[] = []

  for (const si of lastChild.children) {
    if (!si.children || si.children.length < 5) continue

    // version
    const version = extractInteger(si.children[0]!)

    // sid — IssuerAndSerialNumber (SEQUENCE) or subjectKeyIdentifier ([0])
    const sidNode = si.children[1]!
    let issuerDN = ""
    let serialHex = ""
    if (sidNode.tagClass === 0 && sidNode.tagNumber === 0x10 && sidNode.children) {
      // IssuerAndSerialNumber: SEQUENCE { issuer Name, serialNumber INTEGER }
      if (sidNode.children.length >= 2) {
        issuerDN = decodeDNFromAsn1(sidNode.children[0]!)
        serialHex = extractIntegerHex(sidNode.children[1]!)
      }
    }

    // digestAlgorithm — SEQUENCE { OID, ... }
    const digestAlgNode = si.children[2]!
    let digestAlgorithm = ""
    if (digestAlgNode.children?.[0]) {
      const oid = extractOid(digestAlgNode.children[0])
      if (oid) digestAlgorithm = resolveOid(oid)
    }

    // signedAttrs may be present as context [0] at index 3
    // signatureAlgorithm comes after digestAlgorithm (and optional signedAttrs)
    let sigAlgIdx = 3
    if (
      si.children[sigAlgIdx] &&
      si.children[sigAlgIdx]!.tagClass === 2 &&
      si.children[sigAlgIdx]!.tagNumber === 0
    ) {
      sigAlgIdx = 4 // skip signedAttrs
    }

    let signatureAlgorithm = ""
    const sigAlgNode = si.children[sigAlgIdx]
    if (sigAlgNode?.children?.[0]) {
      const oid = extractOid(sigAlgNode.children[0])
      if (oid) signatureAlgorithm = resolveOid(oid)
    }

    signers.push({
      version,
      issuerDN,
      serialHex,
      digestAlgorithm,
      signatureAlgorithm,
    })
  }

  return signers
}

/** Match a signer to the embedded cert by issuer DN + serial number */
function findSignerCert(
  signer: SignerInfoParsed,
  certs: ParsedCert[]
): ParsedCert | null {
  if (!signer.serialHex) return null
  const normalSerial = signer.serialHex.toLowerCase().replace(/^0+/, "")
  for (const pc of certs) {
    const certSerial = pc.cert.serialNumber.toLowerCase().replace(/^0+/, "")
    if (certSerial === normalSerial) return pc
  }
  return null
}

// ── Page ──

function Pkcs7ViewerPage() {
  const [input, setInput] = useState("")
  const [parsed, setParsed] = useState<Asn1Node | null>(null)
  const [info, setInfo] = useState<Pkcs7Info | null>(null)
  const [certs, setCerts] = useState<ParsedCert[]>([])
  const [signerInfos, setSignerInfos] = useState<SignerInfoParsed[]>([])
  const [error, setError] = useState("")
  const { paste, isPasting } = useClipboard()

  // Dialog state for InlineCertCard popup
  const [dialogCert, setDialogCert] = useState<ParsedCert | null>(null)

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setParsed(null)
      setInfo(null)
      setCerts([])
      setSignerInfos([])
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
        setSignerInfos([])
        return
      }
      const root = parseAsn1(bytes, 0)
      setParsed(root)
      const extracted = extractPkcs7Info(root)
      setInfo(extracted)
      setError("")

      // Extract signer infos
      const signers = extractSignerInfos(root)
      setSignerInfos(signers)

      const certDerList = extractCertBytes(root, bytes)
      const parsedCerts: ParsedCert[] = []
      for (const der of certDerList) {
        try {
          const cert = new X509Certificate(der.buffer as ArrayBuffer)
          parsedCerts.push({ cert, sha256: "", sha1: "" })
        } catch { /* skip unparseable certs */ }
      }
      setCerts(parsedCerts)

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
      setSignerInfos([])
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
    <ToolPageLayout
      variant="scroll"
      icon={FileArchive}
      title="PKCS#7 Viewer"
      description="Parse and inspect PKCS#7 / CMS signed-data structures. All processing happens locally in your browser."
      badge="Certificate / Signing"
    >

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
                <SectionCard icon={FileDigit} title="Content Type">
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
                </SectionCard>

                {/* Version */}
                {info.version !== null && (
                  <SectionCard icon={Info} title="Version">
                    <InfoRow
                      label="Version"
                      value={String(info.version)}
                    />
                  </SectionCard>
                )}

                {/* Digest Algorithms */}
                {info.digestAlgorithms.length > 0 && (
                  <SectionCard icon={Award} title="Digest Algorithms">
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
                  </SectionCard>
                )}

                {/* Certificates */}
                <SectionCard icon={Award} title={`Certificates (${info.certificateCount})`}>
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
                        <InlineCertCard
                          key={idx}
                          pc={pc}
                          index={idx}
                          onViewDetails={() => setDialogCert(pc)}
                        />
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Signers */}
                <SectionCard icon={Users} title={`Signers (${info.signerCount})`}>
                  <div className="flex items-center gap-2 mb-3">
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
                  {signerInfos.length > 0 && (
                    <div className="space-y-3">
                      {signerInfos.map((si, idx) => {
                        const matchedCert = findSignerCert(si, certs)
                        return (
                          <SignerCard
                            key={idx}
                            signer={si}
                            index={idx}
                            matchedCert={matchedCert}
                            onViewCert={matchedCert ? () => setDialogCert(matchedCert) : undefined}
                          />
                        )
                      })}
                    </div>
                  )}
                </SectionCard>
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

          {/* Certificates Tab */}
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

      {/* Certificate detail dialog for InlineCertCard */}
      <CertDetailDialog
        cert={dialogCert?.cert ?? null}
        sha256={dialogCert?.sha256 ?? ""}
        sha1={dialogCert?.sha1 ?? ""}
        onClose={() => setDialogCert(null)}
      />
    </ToolPageLayout>
  )
}

// ── Certificate Card (full details, Certificates tab) ──

function CertificateCard({
  pc,
  index,
}: {
  pc: ParsedCert
  index: number
}) {
  const [open, setOpen] = useState(index === 0)
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
            <CertDetailsContent cert={cert} sha256={sha256} sha1={sha1} />
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Inline Certificate Card (Details tab — opens dialog on click) ──

function InlineCertCard({
  pc,
  index,
  onViewDetails,
}: {
  pc: ParsedCert
  index: number
  onViewDetails: () => void
}) {
  const { cert } = pc

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

  return (
    <button
      onClick={onViewDetails}
      className={`w-full text-left rounded-md border p-3 hover:bg-accent/30 transition-colors ${isValid ? "border-emerald-500/20" : isExpired ? "border-destructive/20" : "border-amber-500/20"}`}
    >
      <div className="flex items-start gap-3">
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
            {" · "}
            <span className="text-blue-400">Click to view details</span>
          </p>
        </div>
      </div>
    </button>
  )
}

// ── Signer Card (Details tab — shows signer info with link to cert popup) ──

function SignerCard({
  signer,
  index,
  matchedCert,
  onViewCert,
}: {
  signer: SignerInfoParsed
  index: number
  matchedCert: ParsedCert | null
  onViewCert?: () => void
}) {
  const matchedCN = matchedCert ? extractCN(matchedCert.cert.subject) : ""

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 shrink-0">
          #{index + 1}
        </Badge>
        {signer.version !== null && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
            v{signer.version}
          </Badge>
        )}
        {signer.digestAlgorithm && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
            {signer.digestAlgorithm}
          </Badge>
        )}
        {signer.signatureAlgorithm && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
            {signer.signatureAlgorithm}
          </Badge>
        )}
      </div>

      {signer.issuerDN && (
        <InfoRow label="Issuer" value={signer.issuerDN} />
      )}
      {signer.serialHex && (
        <InfoRow label="Serial" value={formatSerial(signer.serialHex)} mono />
      )}

      {matchedCert && onViewCert && (
        <button
          onClick={onViewCert}
          className="w-full mt-1 flex items-center gap-2 rounded-md border border-blue-500/20 p-2 text-left hover:bg-accent/30 transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-medium truncate flex-1">
            {matchedCN || matchedCert.cert.subject}
          </span>
          <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <span className="text-[10px] text-blue-400 shrink-0">
            View Certificate
          </span>
        </button>
      )}
      {!matchedCert && signer.serialHex && (
        <p className="text-[10px] text-muted-foreground">
          Signing certificate not found in the bundle.
        </p>
      )}
    </div>
  )
}
