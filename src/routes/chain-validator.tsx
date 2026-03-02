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
  ArrowDown,
  XCircle,
  Loader,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToolPageLayout } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import * as x509 from "@peculiar/x509"

export const Route = createFileRoute("/chain-validator")({
  component: ChainValidatorPage,
})

/* ────────────────────────────────────────────── */
/* Types */
/* ────────────────────────────────────────────── */

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
  chainBreak: boolean
}

/* ────────────────────────────────────────────── */
/* Helpers */
/* ────────────────────────────────────────────── */

const PEM_CERT_RE =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g

function extractCN(dn: string): string {
  const match = dn.match(/CN=([^,]+)/)
  return match?.[1]?.trim() ?? dn
}

function parseCerts(input: string): ChainCert[] {
  const pemBlocks = input.match(PEM_CERT_RE)
  if (!pemBlocks || pemBlocks.length === 0) {
    throw new Error("No PEM certificate blocks found.")
  }

  const now = new Date()

  return pemBlocks.map((pem) => {
    const cert = new x509.X509Certificate(pem)
    return {
      cert,
      subjectCN: extractCN(cert.subject),
      issuerCN: extractCN(cert.issuer),
      subject: cert.subject,
      issuer: cert.issuer,
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      isSelfSigned: cert.subject === cert.issuer,
      isExpired: now > cert.notAfter,
      isNotYetValid: now < cert.notBefore,
    }
  })
}

function buildChain(certs: ChainCert[]): ChainLink[] {
  if (certs.length === 0) return []

  const ordered: ChainCert[] = []
  const used = new Set<string>()

  // Find leaf candidate
  let leaf: ChainCert | undefined = certs.find(
    (c) =>
      !certs.some(
        (other) => other.issuer === c.subject && other !== c
      )
  )

  // Fallback to first cert if not found
  if (!leaf) {
    leaf = certs[0]
  }

  // Extra safety (for TypeScript)
  if (!leaf) return []

  ordered.push(leaf)
  used.add(leaf.subject)

  let current: ChainCert | undefined = leaf

  while (current) {
    const next = certs.find(
      (c) =>
        c.subject === current!.issuer &&
        !used.has(c.subject)
    )

    if (!next) break

    ordered.push(next)
    used.add(next.subject)
    current = next
  }

  // Add any remaining certs
  for (const c of certs) {
    if (!used.has(c.subject)) {
      ordered.push(c)
    }
  }

  return ordered.map((cert, i) => {
    const nextCert = ordered[i + 1]

    const chainBreak =
      nextCert !== undefined
        ? cert.issuer !== nextCert.subject
        : false

    return {
      cert,
      chainBreak,
    }
  })
}

/* ────────────────────────────────────────────── */
/* Page */
/* ────────────────────────────────────────────── */

function ChainValidatorPage() {
  const [input, setInput] = useState("")
  const [chain, setChain] = useState<ChainLink[]>([])
  const [error, setError] = useState("")
  const { paste, isPasting } = useClipboard()

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
      setError(e instanceof Error ? e.message : "Parsing failed")
      setChain([])
    }
  }, [debounced])

  /* ───────── Paste (Append Mode) ───────── */

  const handlePaste = async () => {
    const text = await paste()
    if (!text) return

    setInput((prev) =>
      prev.trim()
        ? prev.trim() + "\n\n" + text
        : text
    )
  }

  const handleTextareaPaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const pasted = e.clipboardData.getData("text")
    if (!pasted) return
    e.preventDefault()

    setInput((prev) =>
      prev.trim()
        ? prev.trim() + "\n\n" + pasted
        : pasted
    )
  }

  /* ───────── Multi File Upload ───────── */

  const handleFiles = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files
    if (!files?.length) return

    const blocks: string[] = []

    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)

      // DER detection
      if (bytes[0] === 0x30) {
        const base64 = btoa(
          String.fromCharCode(...bytes)
        )
        const pem =
          "-----BEGIN CERTIFICATE-----\n" +
          base64.match(/.{1,64}/g)?.join("\n") +
          "\n-----END CERTIFICATE-----\n"
        blocks.push(pem)
      } else {
        blocks.push(new TextDecoder().decode(bytes))
      }
    }

    setInput((prev) =>
      prev.trim()
        ? prev.trim() + "\n\n" + blocks.join("\n\n")
        : blocks.join("\n\n")
    )

    e.target.value = ""
  }

  const allValid =
    chain.length &&
    chain.every(
      (l) =>
        !l.cert.isExpired &&
        !l.cert.isNotYetValid &&
        !l.chainBreak
    )

  const hasBreaks = chain.some((l) => l.chainBreak)

  return (
    <ToolPageLayout
      variant="scroll"
      icon={Link2}
      title="Chain Validator"
      description="Paste or upload multiple certificates. Validation runs automatically."
      badge="X.509"
    >

      {/* INPUT */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              disabled={isPasting}
            >
              {isPasting ? <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />}
              Paste from Clipboard
            </Button>

            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Upload
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pem,.crt,.cer,.der"
                  onChange={handleFiles}
                />
              </label>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInput("")}
              disabled={!input}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>

          <Textarea
            placeholder="Paste one or more PEM certificates..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handleTextareaPaste}
            className="h-48 resize-none font-mono text-xs"
          />

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SUMMARY */}
      {chain.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              {allValid ? (
                <CheckCircle2 className="text-emerald-500" />
              ) : hasBreaks ? (
                <XCircle className="text-destructive" />
              ) : (
                <AlertTriangle className="text-amber-500" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {allValid
                    ? "Chain is valid"
                    : hasBreaks
                      ? "Chain has breaks"
                      : "Chain has validity issues"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {chain.length} certificate(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VISUALIZATION */}
      {chain.length > 0 && (
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-2">
            {chain.map((link, i) => (
              <div key={i}>
                <ChainCertCard cert={link.cert} />
                {i < chain.length - 1 && (
                  <ChainConnector
                    chainBreak={link.chainBreak}
                  />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </ToolPageLayout>
  )
}

/* ────────────────────────────────────────────── */
/* Cert Card */
/* ────────────────────────────────────────────── */

function ChainCertCard({ cert }: { cert: ChainCert }) {
  const isValid = !cert.isExpired && !cert.isNotYetValid

  return (
    <Card className={isValid ? "" : "border-destructive/40"}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          {isValid ? (
            <ShieldCheck className="text-emerald-500" />
          ) : (
            <ShieldX className="text-destructive" />
          )}
          <div className="flex-1">
            <p className="font-semibold text-sm truncate">
              {cert.subjectCN}
            </p>
            <p className="text-xs text-muted-foreground">
              Issuer: {cert.issuerCN}
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            From: {cert.notBefore.toLocaleDateString()}
          </div>
          <div>
            To: {cert.notAfter.toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ────────────────────────────────────────────── */

function ChainConnector({ chainBreak }: { chainBreak: boolean }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className={`w-px h-4 ${chainBreak ? "bg-destructive" : "bg-border"}`} />
      {chainBreak ? (
        <div className="text-xs text-destructive flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Chain Break
        </div>
      ) : (
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
      )}
      <div className={`w-px h-4 ${chainBreak ? "bg-destructive" : "bg-border"}`} />
    </div>
  )
}