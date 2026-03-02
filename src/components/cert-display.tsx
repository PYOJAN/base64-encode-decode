import { useState } from "react"
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
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
} from "@peculiar/x509"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Asn1TreeView } from "@/components/asn1-tree-view"
import { SectionCard, InfoRow } from "@/components"
import { parseAsn1 } from "@/utils/asn1-parser"
import { bytesToHex } from "@/utils/pem"
import { resolveOid } from "@/utils/oids"
import {
  DN_LABELS,
  KEY_USAGE_MAP,
  formatSerial,
  formatSerialDecimal,
  formatFingerprint,
  formatDate,
  formatAlgorithm,
  parseDN,
  extractCN,
} from "@/utils/cert-helpers"

// ── DnDisplay ──

export function DnDisplay({ dn }: { dn: string }) {
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

// ── PublicKeyDisplay ──

export function PublicKeyDisplay({
  algorithm,
}: {
  algorithm: KeyAlgorithm & { modulusLength?: number; namedCurve?: string }
}) {
  return (
    <div className="space-y-2">
      <InfoRow label="Algorithm" value={algorithm.name} />
      {algorithm.modulusLength && (
        <InfoRow label="Key Size" value={`${algorithm.modulusLength} bit`} />
      )}
      {algorithm.namedCurve && (
        <InfoRow label="Curve" value={algorithm.namedCurve} />
      )}
    </div>
  )
}

// ── SerialNumberRow ──

export function SerialNumberRow({ hex }: { hex: string }) {
  const [format, setFormat] = useState<"hex" | "decimal">("hex")

  const cycleFormat = () => {
    setFormat((prev) => (prev === "hex" ? "decimal" : "hex"))
  }

  const display =
    format === "hex" ? formatSerial(hex) : formatSerialDecimal(hex)

  return (
    <div className="flex items-start gap-3 text-xs group">
      <span className="text-muted-foreground w-36 shrink-0 pt-0.5 text-right">
        Serial Number
      </span>
      <span className="break-all flex-1 font-mono text-[11px] leading-relaxed">
        {display}
      </span>
      <Badge
        variant="outline"
        className="text-[9px] px-1.5 py-0 shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity select-none"
        onClick={cycleFormat}
        title={format === "hex" ? "Switch to decimal" : "Switch to hex"}
      >
        {format === "hex" ? "HEX" : "DEC"}
      </Badge>
    </div>
  )
}

// ── SanSection ──

export function SanSection({
  san,
}: {
  san: SubjectAlternativeNameExtension
}) {
  const names: { type: string; value: string }[] = []
  try {
    for (const gn of san.names.items) {
      if (gn.type === "dns") names.push({ type: "DNS", value: gn.value })
      else if (gn.type === "ip") names.push({ type: "IP", value: gn.value })
      else if (gn.type === "email")
        names.push({ type: "Email", value: gn.value })
      else if (gn.type === "url") names.push({ type: "URI", value: gn.value })
      else names.push({ type: gn.type, value: String(gn.value) })
    }
  } catch {
    // fallback
  }

  if (names.length === 0) return null

  return (
    <SectionCard
      icon={Globe}
      title={`Subject Alternative Names (${names.length})`}
    >
      <div className="space-y-1.5">
        {names.map((n, i) => (
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
  )
}

// ── KeyUsageSection ──

export function KeyUsageSection({ ext }: { ext: KeyUsagesExtension }) {
  const active: string[] = []
  for (const [flag, name] of KEY_USAGE_MAP) {
    if (ext.usages & flag) active.push(name)
  }
  return (
    <SectionCard icon={Key} title="Key Usage">
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
            This extension is marked as{" "}
            <span className="text-destructive font-medium">critical</span>.
          </p>
        )}
      </div>
    </SectionCard>
  )
}

// ── ExtKeyUsageSection ──

export function ExtKeyUsageSection({
  ext,
}: {
  ext: ExtendedKeyUsageExtension
}) {
  return (
    <SectionCard icon={Puzzle} title="Extended Key Usage">
      <div className="flex flex-wrap gap-1.5">
        {ext.usages.map((oid, i) => (
          <Badge key={i} variant="secondary" className="text-[11px]">
            {resolveOid(String(oid))}
          </Badge>
        ))}
      </div>
    </SectionCard>
  )
}

// ── BasicConstraintsSection ──

export function BasicConstraintsSection({
  ext,
}: {
  ext: BasicConstraintsExtension
}) {
  return (
    <SectionCard icon={Info} title="Basic Constraints">
      <div className="space-y-2">
        <InfoRow
          label="Certificate Authority"
          value={ext.ca ? "Yes" : "No"}
        />
        {ext.pathLength !== undefined && (
          <InfoRow label="Path Length" value={String(ext.pathLength)} />
        )}
        {ext.critical && (
          <p className="text-[10px] text-muted-foreground">
            This extension is marked as{" "}
            <span className="text-destructive font-medium">critical</span>.
          </p>
        )}
      </div>
    </SectionCard>
  )
}

// ── CrlDistSection ──

export function CrlDistSection({
  ext,
}: {
  ext: CRLDistributionPointsExtension
}) {
  const urls: string[] = []
  try {
    for (const dp of ext.distributionPoints) {
      if (dp.distributionPoint?.fullName) {
        for (const gn of dp.distributionPoint.fullName) {
          if (gn.uniformResourceIdentifier)
            urls.push(gn.uniformResourceIdentifier)
          else if (gn.dNSName) urls.push(gn.dNSName)
        }
      }
    }
  } catch {
    // fallback
  }

  if (urls.length === 0) return null

  return (
    <SectionCard icon={Link2} title="CRL Distribution Points">
      <div className="space-y-1.5">
        {urls.map((url, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-[11px] text-blue-400 break-all">
              {url}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── AiaSection ──

export function AiaSection({ ext }: { ext: AuthorityInfoAccessExtension }) {
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
    <SectionCard icon={BookOpen} title="Authority Information Access">
      <div className="space-y-2">
        {ocspUrls.map((url, i) => (
          <div key={`ocsp-${i}`} className="flex items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className="text-[10px] font-mono px-1.5 py-0 shrink-0"
            >
              OCSP
            </Badge>
            <span className="font-mono text-[11px] text-blue-400 break-all">
              {url}
            </span>
          </div>
        ))}
        {caIssuers.map((url, i) => (
          <div key={`ca-${i}`} className="flex items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className="text-[10px] font-mono px-1.5 py-0 shrink-0"
            >
              CA Issuers
            </Badge>
            <span className="font-mono text-[11px] text-blue-400 break-all">
              {url}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── PolicySection ──

export function PolicySection({ ext }: { ext: CertificatePolicyExtension }) {
  if (ext.policies.length === 0) return null
  return (
    <SectionCard
      icon={Award}
      title={`Certificate Policies (${ext.policies.length})`}
    >
      <div className="space-y-1.5">
        {ext.policies.map((oid, i) => {
          const name = resolveOid(oid)
          const isKnown = name !== oid
          return (
            <div key={i} className="text-xs">
              {isKnown ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {oid}
                  </span>
                </div>
              ) : (
                <span className="font-mono">{oid}</span>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ── OtherExtensionItem ──

export function OtherExtensionItem({
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

// ── CertDetailsContent ──
// Comprehensive cert detail display component that replaces duplicated code

export function CertDetailsContent({
  cert,
  sha256,
  sha1,
}: {
  cert: X509Certificate
  sha256: string
  sha1: string
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
  const progressPct = Math.max(
    0,
    Math.min(100, (elapsedDays / totalDays) * 100)
  )

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
    "2.5.29.19",
    "2.5.29.15",
    "2.5.29.37",
    "2.5.29.17",
    "2.5.29.14",
    "2.5.29.35",
    "2.5.29.31",
    "1.3.6.1.5.5.7.1.1",
    "2.5.29.32",
  ])
  const otherExtensions = cert.extensions.filter(
    (e) => !knownOids.has(e.type)
  )

  const subjectCN = extractCN(cert.subject)

  return (
    <div className="space-y-4">
      {/* Status Banner */}
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
                  <Badge
                    variant="outline"
                    className="text-[10px] shrink-0"
                  >
                    Self-Signed
                  </Badge>
                )}
                {basicConstraints?.ca && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-violet-400 border-violet-400/30 shrink-0"
                  >
                    CA
                  </Badge>
                )}
                <Badge
                  variant={isValid ? "secondary" : "destructive"}
                  className="text-[10px] shrink-0"
                >
                  {isValid
                    ? "Valid"
                    : isExpired
                      ? "Expired"
                      : "Not Yet Valid"}
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

      {/* Certificate Details */}
      <SectionCard icon={FileDigit} title="Certificate Details">
        <div className="space-y-2">
          <InfoRow label="Version" value="3 (0x2)" />
          <SerialNumberRow hex={cert.serialNumber} />
          <InfoRow
            label="Signature Algorithm"
            value={formatAlgorithm(cert.signatureAlgorithm)}
          />
          <InfoRow
            label="DER Size"
            value={`${(cert.rawData as ArrayBuffer).byteLength} bytes`}
          />
        </div>
      </SectionCard>

      {/* Subject */}
      <SectionCard icon={ShieldCheck} title="Subject">
        <DnDisplay dn={cert.subject} />
      </SectionCard>

      {/* Issuer */}
      <SectionCard icon={Award} title="Issuer">
        <DnDisplay dn={cert.issuer} />
      </SectionCard>

      {/* Validity Period */}
      <SectionCard icon={Clock} title="Validity Period">
        <div className="space-y-2">
          <InfoRow label="Not Before" value={formatDate(notBefore)} />
          <InfoRow label="Not After" value={formatDate(notAfter)} />
          <InfoRow label="Duration" value={`${totalDays} days`} />
        </div>
      </SectionCard>

      {/* Public Key Info */}
      <SectionCard icon={Key} title="Public Key Info">
        <PublicKeyDisplay
          algorithm={
            cert.publicKey.algorithm as KeyAlgorithm & {
              modulusLength?: number
              namedCurve?: string
            }
          }
        />
      </SectionCard>

      {/* Subject Alternative Names */}
      {san && <SanSection san={san} />}

      {/* Key Usage */}
      {keyUsage && <KeyUsageSection ext={keyUsage} />}

      {/* Extended Key Usage */}
      {extKeyUsage && <ExtKeyUsageSection ext={extKeyUsage} />}

      {/* Basic Constraints */}
      {basicConstraints && (
        <BasicConstraintsSection ext={basicConstraints} />
      )}

      {/* Key Identifiers */}
      {(ski || aki) && (
        <SectionCard icon={Key} title="Key Identifiers">
          <div className="space-y-2">
            {ski && (
              <InfoRow label="Subject Key ID" value={ski.keyId} mono />
            )}
            {aki?.keyId && (
              <InfoRow label="Authority Key ID" value={aki.keyId} mono />
            )}
          </div>
        </SectionCard>
      )}

      {/* CRL Distribution Points */}
      {crlDist && <CrlDistSection ext={crlDist} />}

      {/* Authority Information Access */}
      {aia && <AiaSection ext={aia} />}

      {/* Certificate Policies */}
      {certPolicy && <PolicySection ext={certPolicy} />}

      {/* Other Extensions */}
      {otherExtensions.length > 0 && (
        <SectionCard
          icon={Puzzle}
          title={`Other Extensions (${otherExtensions.length})`}
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
          <InfoRow
            label="SHA-256"
            value={formatFingerprint(sha256)}
            mono
          />
          <InfoRow
            label="SHA-1"
            value={formatFingerprint(sha1)}
            mono
          />
        </div>
      </SectionCard>
    </div>
  )
}
