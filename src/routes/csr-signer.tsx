import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  PenTool,
  ClipboardPaste,
  Trash2,
  Upload,
  Loader,
  Copy,
  AlertTriangle,
  ShieldCheck,
  FileDigit,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ToolPageLayout } from "@/components"
import { useClipboard } from "@/hooks"
import * as x509 from "@peculiar/x509"
import {
  formatAlgorithm,
  extractCN,
} from "@/utils/cert-helpers"
import {
  inputToBytes,
  detectPemType,
} from "@/utils/pem"

export const Route = createFileRoute("/csr-signer")({
  component: CsrSignerPage,
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

// ── Helpers ──

function arrayBufferToPem(buffer: ArrayBuffer, type: string): string {
  const bytes = new Uint8Array(buffer)
  const b64 = btoa(String.fromCharCode(...bytes))
  const lines = b64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`
}

function randomSerialHex(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  // Ensure positive (set MSB to 0)
  arr[0] = arr[0]! & 0x7f
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// ── Page ──

function CsrSignerPage() {
  const [csrInput, setCsrInput] = useState("")
  const [csrParsed, setCsrParsed] = useState<x509.Pkcs10CertificateRequest | null>(null)
  const [csrError, setCsrError] = useState("")

  const [selectedAlgo, setSelectedAlgo] = useState("rsa-2048")
  const [validityDays, setValidityDays] = useState(365)
  const [caCN, setCaCN] = useState("Self-Signed CA")

  const [signedCertPem, setSignedCertPem] = useState("")
  const [caCertPem, setCaCertPem] = useState("")
  const [caKeyPem, setCaKeyPem] = useState("")
  const [loading, setLoading] = useState(false)
  const [signError, setSignError] = useState("")

  const { copy, paste, isPasting } = useClipboard()

  // Parse CSR input
  const handleCsrInput = (value: string) => {
    setCsrInput(value)
    setCsrParsed(null)
    setCsrError("")
    setSignedCertPem("")
    setCaCertPem("")
    setCaKeyPem("")
    setSignError("")

    if (!value.trim()) return

    try {
      const bytes = inputToBytes(value)
      if (!bytes) {
        setCsrError("Unable to parse input.")
        return
      }

      const pemType = detectPemType(value)
      let parsed: x509.Pkcs10CertificateRequest | null = null

      if (
        pemType === "CERTIFICATE REQUEST" ||
        pemType === "NEW CERTIFICATE REQUEST" ||
        !pemType
      ) {
        try {
          parsed = new x509.Pkcs10CertificateRequest(bytes.buffer as ArrayBuffer)
        } catch { /* not a CSR */ }
      }

      if (!parsed) {
        try {
          parsed = new x509.Pkcs10CertificateRequest(bytes.buffer as ArrayBuffer)
        } catch {
          setCsrError("Unable to parse as PKCS#10 Certificate Signing Request.")
          return
        }
      }

      setCsrParsed(parsed)
    } catch (e) {
      setCsrError(e instanceof Error ? e.message : "Failed to parse CSR")
    }
  }

  const handlePaste = async () => {
    const text = await paste()
    if (text) handleCsrInput(text)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer)
      if (arr[0] === 0x30) {
        const b64 = btoa(String.fromCharCode(...arr))
        handleCsrInput(b64)
      } else {
        handleCsrInput(new TextDecoder().decode(arr))
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  const handleSign = async () => {
    if (!csrParsed) return
    setLoading(true)
    setSignError("")
    setSignedCertPem("")
    setCaCertPem("")
    setCaKeyPem("")

    try {
      const algo = KEY_ALGORITHMS.find((a) => a.id === selectedAlgo)!

      // 1. Generate CA key pair
      const caKeys = await crypto.subtle.generateKey(
        algo.generateParams,
        true,
        ["sign", "verify"]
      )

      const now = new Date()
      const caSubject = `CN=${caCN.trim() || "Self-Signed CA"}`

      // 2. Create self-signed CA certificate
      const caCert = await x509.X509CertificateGenerator.create({
        serialNumber: randomSerialHex(),
        subject: caSubject,
        issuer: caSubject,
        notBefore: now,
        notAfter: addDays(now, validityDays + 365), // CA valid 1 year longer
        signingAlgorithm: algo.signingAlgorithm,
        publicKey: caKeys.publicKey,
        signingKey: caKeys.privateKey,
        extensions: [
          new x509.BasicConstraintsExtension(true, undefined, true),
          new x509.KeyUsagesExtension(
            x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
            true
          ),
        ],
      })

      // 3. Build extensions from CSR (copy SANs if present)
      const signedExtensions: x509.Extension[] = [
        new x509.BasicConstraintsExtension(false),
      ]
      try {
        for (const ext of csrParsed.extensions) {
          if (ext.type === "2.5.29.17") {
            // Copy SAN extension from CSR
            signedExtensions.push(ext)
          }
        }
      } catch {
        // CSR may not have extensions
      }

      // 4. Sign the CSR
      const signedCert = await x509.X509CertificateGenerator.create({
        serialNumber: randomSerialHex(),
        subject: csrParsed.subject,
        issuer: caCert.subject,
        notBefore: now,
        notAfter: addDays(now, validityDays),
        signingAlgorithm: algo.signingAlgorithm,
        publicKey: csrParsed.publicKey,
        signingKey: caKeys.privateKey,
        extensions: signedExtensions,
      })

      // Export PEMs
      setSignedCertPem(signedCert.toString("pem"))
      setCaCertPem(caCert.toString("pem"))

      const exportedKey = await crypto.subtle.exportKey("pkcs8", caKeys.privateKey)
      setCaKeyPem(arrayBufferToPem(exportedKey, "PRIVATE KEY"))
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Failed to sign CSR")
    } finally {
      setLoading(false)
    }
  }

  const subjectCN = csrParsed ? extractCN(csrParsed.subject) : ""

  return (
    <ToolPageLayout
      variant="scroll"
      icon={PenTool}
      title="CSR Signer"
      description="Sign a Certificate Signing Request with an auto-generated CA. All processing happens locally in your browser."
      badge="Certificate / Signing"
    >
      {/* CSR Input */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePaste}>
              {isPasting ? (
                <Loader className="animate-spin mr-1.5 h-3.5 w-3.5" />
              ) : (
                <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              )}
              Paste CSR
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
              onClick={() => handleCsrInput("")}
              disabled={!csrInput}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
          <Textarea
            placeholder={`-----BEGIN CERTIFICATE REQUEST-----\nMIIC...\n-----END CERTIFICATE REQUEST-----`}
            value={csrInput}
            onChange={(e) => handleCsrInput(e.target.value)}
            rows={5}
            className="resize-none font-mono text-xs leading-relaxed"
          />
          {csrError && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {csrError}
            </p>
          )}
          {csrParsed && (
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-medium">CSR parsed successfully</span>
              <Badge variant="secondary" className="text-[10px]">PKCS#10</Badge>
              {subjectCN && (
                <span className="text-muted-foreground truncate">
                  Subject: {subjectCN}
                </span>
              )}
              <span className="text-muted-foreground">
                Sig: {formatAlgorithm(csrParsed.signatureAlgorithm)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signing Configuration */}
      {csrParsed && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <FileDigit className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Signing Configuration</h3>
            </div>
            <Separator />

            {/* CA Key Algorithm */}
            <div className="space-y-2">
              <Label className="text-xs">CA Key Algorithm</Label>
              <div className="flex flex-wrap gap-2">
                {KEY_ALGORITHMS.map((algo) => (
                  <Button
                    key={algo.id}
                    variant={selectedAlgo === algo.id ? "secondary" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedAlgo(algo.id)}
                  >
                    {algo.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Validity Period */}
            <div className="space-y-2">
              <Label htmlFor="validity" className="text-xs">
                Validity Period (days)
              </Label>
              <Input
                id="validity"
                type="number"
                min={1}
                max={9999}
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value) || 365)}
                className="w-32 font-mono"
              />
            </div>

            {/* CA Subject */}
            <div className="space-y-2">
              <Label htmlFor="ca-cn" className="text-xs">
                CA Common Name
              </Label>
              <Input
                id="ca-cn"
                type="text"
                value={caCN}
                onChange={(e) => setCaCN(e.target.value)}
                placeholder="Self-Signed CA"
                className="max-w-sm"
              />
            </div>

            {/* Sign Button */}
            <Button onClick={handleSign} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader className="animate-spin mr-2 h-4 w-4" />
                  Signing...
                </>
              ) : (
                <>
                  <PenTool className="mr-2 h-4 w-4" />
                  Sign CSR
                </>
              )}
            </Button>

            {signError && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {signError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Output */}
      {signedCertPem && (
        <div className="space-y-4">
          {/* Signed Certificate */}
          <Card className="border-emerald-500/30">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-medium">Signed Certificate</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(signedCertPem, "Signed certificate copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={signedCertPem}
                readOnly
                rows={8}
                className="resize-none font-mono text-xs leading-relaxed"
              />
            </CardContent>
          </Card>

          {/* CA Certificate */}
          <Card className="border-sky-500/30">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-500" />
                  <h3 className="text-sm font-medium">CA (Signer) Certificate</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(caCertPem, "CA certificate copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={caCertPem}
                readOnly
                rows={8}
                className="resize-none font-mono text-xs leading-relaxed"
              />
            </CardContent>
          </Card>

          {/* CA Private Key */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-medium">CA Private Key</h3>
                  <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                    Sensitive
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(caKeyPem, "CA private key copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <p className="text-[11px] text-amber-500/80">
                This private key was generated locally and never leaves your browser. Keep it secure.
              </p>
              <Textarea
                value={caKeyPem}
                readOnly
                rows={8}
                className="resize-none font-mono text-xs leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </ToolPageLayout>
  )
}
