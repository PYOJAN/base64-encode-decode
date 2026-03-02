import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FilePlus2,
  Copy,
  Trash2,
  Plus,
  X,
  Loader,
  KeyRound,
  FileText,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

import { ToolPageLayout } from "@/components"
import { useClipboard } from "@/hooks"
import * as x509 from "@peculiar/x509"

export const Route = createFileRoute("/csr-generator")({
  component: CsrGeneratorPage,
})

// ── Key Algorithm Options ──

interface KeyAlgoOption {
  label: string
  id: string
  generateParams: RsaHashedKeyGenParams | EcKeyGenParams
  signingAlgorithm: Algorithm | EcdsaParams
}

const KEY_ALGORITHMS: KeyAlgoOption[] = [
  {
    label: "RSA 2048",
    id: "rsa-2048",
    generateParams: {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    signingAlgorithm: { name: "RSASSA-PKCS1-v1_5" },
  },
  {
    label: "RSA 4096",
    id: "rsa-4096",
    generateParams: {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    signingAlgorithm: { name: "RSASSA-PKCS1-v1_5" },
  },
  {
    label: "ECDSA P-256",
    id: "ecdsa-p256",
    generateParams: {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    signingAlgorithm: { name: "ECDSA", hash: "SHA-256" } as EcdsaParams,
  },
  {
    label: "ECDSA P-384",
    id: "ecdsa-p384",
    generateParams: {
      name: "ECDSA",
      namedCurve: "P-384",
    },
    signingAlgorithm: { name: "ECDSA", hash: "SHA-384" } as EcdsaParams,
  },
]

// ── Helper: ArrayBuffer to PEM ──

function arrayBufferToPem(buffer: ArrayBuffer, type: string): string {
  const bytes = new Uint8Array(buffer)
  const b64 = btoa(String.fromCharCode(...bytes))
  const lines = b64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`
}

// ── Page ──

function CsrGeneratorPage() {
  // Form fields
  const [cn, setCn] = useState("")
  const [o, setO] = useState("")
  const [ou, setOu] = useState("")
  const [c, setC] = useState("")
  const [st, setSt] = useState("")
  const [l, setL] = useState("")

  // SANs
  const [sans, setSans] = useState<string[]>([])
  const [sanInput, setSanInput] = useState("")

  // Key algorithm
  const [selectedAlgo, setSelectedAlgo] = useState("rsa-2048")

  // Output
  const [csrPem, setCsrPem] = useState("")
  const [privateKeyPem, setPrivateKeyPem] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { copy } = useClipboard()

  const addSan = () => {
    const trimmed = sanInput.trim()
    if (trimmed && !sans.includes(trimmed)) {
      setSans([...sans, trimmed])
      setSanInput("")
    }
  }

  const removeSan = (index: number) => {
    setSans(sans.filter((_, i) => i !== index))
  }

  const handleSanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addSan()
    }
  }

  const handleGenerate = async () => {
    if (!cn.trim()) {
      setError("Common Name (CN) is required.")
      return
    }

    setLoading(true)
    setError("")
    setCsrPem("")
    setPrivateKeyPem("")

    try {
      const algo = KEY_ALGORITHMS.find((a) => a.id === selectedAlgo)!

      // Generate key pair
      const keys = await crypto.subtle.generateKey(
        algo.generateParams,
        true,
        ["sign", "verify"]
      )

      // Build subject DN string
      const dnParts: string[] = []
      if (cn.trim()) dnParts.push(`CN=${cn.trim()}`)
      if (o.trim()) dnParts.push(`O=${o.trim()}`)
      if (ou.trim()) dnParts.push(`OU=${ou.trim()}`)
      if (c.trim()) dnParts.push(`C=${c.trim()}`)
      if (st.trim()) dnParts.push(`ST=${st.trim()}`)
      if (l.trim()) dnParts.push(`L=${l.trim()}`)
      const subjectName = dnParts.join(", ")

      // Build extensions
      const extensions: x509.Extension[] = []
      if (sans.length > 0) {
        extensions.push(
          new x509.SubjectAlternativeNameExtension(
            sans.map((d) => ({ type: "dns" as const, value: d }))
          )
        )
      }

      // Generate CSR
      const csr = await x509.Pkcs10CertificateRequestGenerator.create({
        name: subjectName,
        keys,
        signingAlgorithm: algo.signingAlgorithm,
        extensions,
      })

      const csrPemOutput = csr.toString("pem")
      setCsrPem(csrPemOutput)

      // Export private key
      const pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey)
      const keyPemOutput = arrayBufferToPem(pkcs8, "PRIVATE KEY")
      setPrivateKeyPem(keyPemOutput)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate CSR"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setCn("")
    setO("")
    setOu("")
    setC("")
    setSt("")
    setL("")
    setSans([])
    setSanInput("")
    setCsrPem("")
    setPrivateKeyPem("")
    setError("")
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={FilePlus2}
      title="CSR Generator"
      description="Generate Certificate Signing Requests using the Web Crypto API. Keys are generated locally in your browser."
      badge="Certificate / Signing"
    >

      {/* Form */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Subject Fields */}
          <div>
            <h3 className="text-sm font-medium mb-4">Subject Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="cn">
                  Common Name (CN) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cn"
                  placeholder="example.com"
                  value={cn}
                  onChange={(e) => setCn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o">Organization (O)</Label>
                <Input
                  id="o"
                  placeholder="Acme Inc."
                  value={o}
                  onChange={(e) => setO(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ou">Organizational Unit (OU)</Label>
                <Input
                  id="ou"
                  placeholder="Engineering"
                  value={ou}
                  onChange={(e) => setOu(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c">Country (C)</Label>
                <Input
                  id="c"
                  placeholder="US"
                  value={c}
                  onChange={(e) => setC(e.target.value)}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st">State / Province (ST)</Label>
                <Input
                  id="st"
                  placeholder="California"
                  value={st}
                  onChange={(e) => setSt(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="l">Locality (L)</Label>
                <Input
                  id="l"
                  placeholder="San Francisco"
                  value={l}
                  onChange={(e) => setL(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Subject Alternative Names */}
          <div>
            <h3 className="text-sm font-medium mb-4">
              Subject Alternative Names (SANs)
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="DNS name, e.g. *.example.com"
                value={sanInput}
                onChange={(e) => setSanInput(e.target.value)}
                onKeyDown={handleSanKeyDown}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addSan}
                disabled={!sanInput.trim()}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {sans.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {sans.map((san, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-xs font-mono pl-2.5 pr-1 py-1 flex items-center gap-1.5"
                  >
                    {san}
                    <button
                      onClick={() => removeSan(i)}
                      className="hover:bg-muted rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Key Algorithm */}
          <div>
            <h3 className="text-sm font-medium mb-4">Key Algorithm</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {KEY_ALGORITHMS.map((algo) => (
                <button
                  key={algo.id}
                  onClick={() => setSelectedAlgo(algo.id)}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${selectedAlgo === algo.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/30 text-muted-foreground"
                    }`}
                >
                  {algo.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={loading || !cn.trim()}>
              {loading ? (
                <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {loading ? "Generating..." : "Generate CSR"}
            </Button>
            <Button variant="ghost" onClick={handleClear}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear All
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Output: CSR */}
      {csrPem && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <h3 className="text-sm font-medium">Certificate Signing Request (CSR)</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(csrPem, "CSR PEM copied")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <Separator />
            <Textarea
              readOnly
              value={csrPem}
              rows={8}
              className="resize-none font-mono text-[11px] leading-relaxed bg-muted/30"
            />
          </CardContent>
        </Card>
      )}

      {/* Output: Private Key */}
      {privateKeyPem && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-500 shrink-0" />
                <h3 className="text-sm font-medium">Private Key</h3>
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-500 border-amber-500/30"
                >
                  Sensitive
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copy(privateKeyPem, "Private key PEM copied")
                }
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <Separator />
            <p className="text-[10px] text-amber-500/80">
              Keep this private key secure. It should never be shared or
              transmitted over insecure channels.
            </p>
            <Textarea
              readOnly
              value={privateKeyPem}
              rows={8}
              className="resize-none font-mono text-[11px] leading-relaxed bg-muted/30"
            />
          </CardContent>
        </Card>
      )}
    </ToolPageLayout>
  )
}
