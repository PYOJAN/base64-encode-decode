import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Link2,
  ClipboardPaste,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldX,
  Clock,
  ArrowDown,
  XCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import * as x509 from "@peculiar/x509"

export const Route = createFileRoute("/chain-validator")({
  component: ChainValidatorPage,
})

// ── Types ──

interface ChainCert {
  cert: x509.X509Certificate
  subjectCN: string
  issuerCN: string
  subject: string
  issuer: string
  notBefore: Date
  notAfter: Date
  isSelfSigned: boolean
  isExpired: boolean
  isNotYetValid: boolean
}

interface ChainLink {
  cert: ChainCert
  chainBreak: boolean // true if issuer doesn't match next cert's subject
}

// ── Helpers ──

const PEM_CERT_RE =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g

function extractCN(dn: string): string {
  const match = dn.match(/CN=([^,]+)/)
  return match?.[1]?.trim() ?? dn
}

function parseCerts(input: string): ChainCert[] {
  const pemBlocks = input.match(PEM_CERT_RE)
  if (!pemBlocks || pemBlocks.length === 0) {
    throw new Error("No PEM certificate blocks found in the input.")
  }

  const now = new Date()
  return pemBlocks.map((pem) => {
    const cert = new x509.X509Certificate(pem)
    const notBefore = cert.notBefore
    const notAfter = cert.notAfter
    return {
      cert,
      subjectCN: extractCN(cert.subject),
      issuerCN: extractCN(cert.issuer),
      subject: cert.subject,
      issuer: cert.issuer,
      notBefore,
      notAfter,
      isSelfSigned: cert.subject === cert.issuer,
      isExpired: now > notAfter,
      isNotYetValid: now < notBefore,
    }
  })
}

function buildChain(certs: ChainCert[]): ChainLink[] {
  if (certs.length === 0) return []

  // Try to order: leaf first, root last
  // Start with a cert that is NOT an issuer of any other cert (leaf candidate)
  const subjectMap = new Map<string, ChainCert>()
  const issuerSet = new Set<string>()

  for (const c of certs) {
    subjectMap.set(c.subject, c)
    issuerSet.add(c.issuer)
  }

  // Leaf = subject is not in any other cert's issuer
  let leaf = certs.find(
    (c) =>
      !certs.some(
        (other) => other.issuer === c.subject && other !== c
      )
  )

  // If no clear leaf, just use the first cert
  if (!leaf) leaf = certs[0]!

  // Build ordered chain by following issuer
  const ordered: ChainCert[] = [leaf]
  const used = new Set<string>([leaf.subject])

  let current = leaf
  for (let i = 0; i < certs.length - 1; i++) {
    const next = certs.find(
      (c) => c.subject === current.issuer && !used.has(c.subject)
    )
    if (next) {
      ordered.push(next)
      used.add(next.subject)
      current = next
    } else {
      // Add remaining certs that haven't been placed
      break
    }
  }

  // Add any certs not yet in the chain
  for (const c of certs) {
    if (!used.has(c.subject)) {
      ordered.push(c)
      used.add(c.subject)
    }
  }

  // Build chain links with break detection
  return ordered.map((cert, i) => {
    let chainBreak = false
    if (i < ordered.length - 1) {
      const nextCert = ordered[i + 1]!
      chainBreak = cert.issuer !== nextCert.subject
    }
    return { cert, chainBreak }
  })
}

// ── Page ──

function ChainValidatorPage() {
  const [input, setInput] = useState("")
  const [chain, setChain] = useState<ChainLink[]>([])
  const [error, setError] = useState("")
  const { paste } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setChain([])
      setError("")
      return
    }
    try {
      const certs = parseCerts(debounced)
      const ordered = buildChain(certs)
      setChain(ordered)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse certificates")
      setChain([])
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

  const allValid = chain.length > 0 && chain.every(
    (l) => !l.cert.isExpired && !l.cert.isNotYetValid && !l.chainBreak
  )
  const hasBreaks = chain.some((l) => l.chainBreak)
  const hasExpired = chain.some((l) => l.cert.isExpired || l.cert.isNotYetValid)

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={Link2}
        title="Chain Validator"
        description="Validate and visualize X.509 certificate chains. Paste multiple PEM certificates to check chain order and validity."
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
                Upload PEM
                <input
                  type="file"
                  className="hidden"
                  accept=".pem,.crt,.cer,.der,.p7b"
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
            placeholder={`-----BEGIN CERTIFICATE-----\nMIIC... (leaf certificate)\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIID... (intermediate CA)\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIE... (root CA)\n-----END CERTIFICATE-----`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
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

      {/* Chain Summary */}
      {chain.length > 0 && (
        <Card
          className={
            allValid
              ? "border-emerald-500/30 bg-emerald-500/5"
              : hasBreaks
                ? "border-destructive/30 bg-destructive/5"
                : hasExpired
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-muted-foreground/20 bg-muted/5"
          }
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              {allValid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : hasBreaks ? (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">
                    {allValid
                      ? "Chain is valid"
                      : hasBreaks
                        ? "Chain has breaks"
                        : "Chain has validity issues"}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-[10px] shrink-0"
                  >
                    {chain.length} certificate{chain.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {allValid
                    ? "All certificates are valid and the chain is properly ordered."
                    : hasBreaks
                      ? "One or more issuer/subject mismatches were found in the chain."
                      : "One or more certificates have expired or are not yet valid."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chain Visualization */}
      {chain.length > 0 && (
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-0">
            {chain.map((link, i) => (
              <div key={i}>
                <ChainCertCard cert={link.cert} index={i} total={chain.length} />
                {i < chain.length - 1 && (
                  <ChainConnector chainBreak={link.chainBreak} />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

// ── Chain Cert Card ──

function ChainCertCard({
  cert,
  index,
  total,
}: {
  cert: ChainCert
  index: number
  total: number
}) {
  const isValid = !cert.isExpired && !cert.isNotYetValid
  const isLeaf = index === 0 && total > 1
  const isRoot = cert.isSelfSigned

  return (
    <Card
      className={
        isValid
          ? "border-emerald-500/30"
          : "border-destructive/30"
      }
    >
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          {isValid ? (
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <ShieldX className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">
                {cert.subjectCN}
              </p>
              {isLeaf && (
                <Badge
                  variant="secondary"
                  className="text-[10px] shrink-0"
                >
                  Leaf
                </Badge>
              )}
              {isRoot && (
                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0"
                >
                  Self-Signed
                </Badge>
              )}
              {cert.isSelfSigned && !isLeaf && (
                <Badge
                  variant="outline"
                  className="text-[10px] text-violet-400 border-violet-400/30 shrink-0"
                >
                  Root CA
                </Badge>
              )}
              <Badge
                variant={isValid ? "secondary" : "destructive"}
                className="text-[10px] shrink-0"
              >
                {isValid
                  ? "Valid"
                  : cert.isExpired
                    ? "Expired"
                    : "Not Yet Valid"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Issuer: {cert.issuerCN}
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">From:</span>
            <span className="font-mono text-[11px]">
              {cert.notBefore.toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">To:</span>
            <span className="font-mono text-[11px]">
              {cert.notAfter.toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Chain Connector ──

function ChainConnector({ chainBreak }: { chainBreak: boolean }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div
        className={`w-px h-4 ${
          chainBreak ? "bg-destructive" : "bg-border"
        }`}
      />
      {chainBreak ? (
        <div className="flex items-center gap-1.5 py-1">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-[10px] text-destructive font-medium">
            Chain Break - Issuer mismatch
          </span>
        </div>
      ) : (
        <ArrowDown
          className={`h-4 w-4 text-muted-foreground`}
        />
      )}
      <div
        className={`w-px h-4 ${
          chainBreak ? "bg-destructive" : "bg-border"
        }`}
      />
    </div>
  )
}
