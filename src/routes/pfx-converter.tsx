import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  FileKey,
  KeyRound,
  ShieldCheck,
  Link2,
  Download,
  Eye,
  EyeOff,
  Loader,
  Trash2,
  Package,
  Copy,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  ToolPageLayout,
  SectionCard,
  InfoRow,
  ErrorBanner,
  CopyButton,
} from "@/components"
import { useClipboard } from "@/hooks"
import { FileDropzone } from "@/components/file-dropzone"
import { fingerprint } from "@/utils/pem"
import { parsePkcs12, type Pkcs12Result, type Pkcs12Cert } from "@/utils/pkcs12"

export const Route = createFileRoute("/pfx-converter")({
  component: PfxConverterPage,
})

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
}

function PfxConverterPage() {
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [result, setResult] = useState<Pkcs12Result | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [certFingerprint, setCertFingerprint] = useState("")

  const { copy } = useClipboard()

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setFileBytes(new Uint8Array(reader.result as ArrayBuffer))
      setFileName(file.name)
      setResult(null)
      setError("")
      setCertFingerprint("")
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDecrypt = async () => {
    if (!fileBytes) return
    setLoading(true)
    setError("")
    setResult(null)
    setCertFingerprint("")

    try {
      const parsed = parsePkcs12(fileBytes, password)
      setResult(parsed)

      if (parsed.certificate) {
        const fp = await fingerprint(parsed.certificate.der, "SHA-256")
        setCertFingerprint(fp)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to parse PFX file"
      if (
        msg.includes("Invalid password") ||
        msg.includes("PKCS#12 MAC could not be verified") ||
        msg.includes("Too few bytes to read")
      ) {
        setError("Invalid password or corrupted PFX file.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFileBytes(null)
    setFileName("")
    setPassword("")
    setResult(null)
    setError("")
    setCertFingerprint("")
  }

  const downloadDer = (cert: Pkcs12Cert, name: string) => {
    const blob = new Blob([cert.der as BlobPart], { type: "application/x-x509-ca-cert" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const buildFullChainPem = (): string => {
    if (!result) return ""
    const parts: string[] = []
    if (result.certificate) parts.push(result.certificate.pem.trim())
    for (const ca of result.caChain) parts.push(ca.pem.trim())
    return parts.join("\n")
  }

  const buildCertKeyPem = (): string => {
    if (!result) return ""
    const parts: string[] = []
    if (result.certificate) parts.push(result.certificate.pem.trim())
    if (result.privateKeyPem) parts.push(result.privateKeyPem.trim())
    return parts.join("\n")
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={FileKey}
      title="PFX / PKCS#12 Converter"
      description="Extract certificates, private keys, and CA chains from PFX/P12 files into PEM format. All processing happens locally in your browser."
      badge="Certificate / Signing"
    >
      {/* Upload + Password */}
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {!fileBytes ? (
            <FileDropzone
              onFile={handleFile}
              accept=".pfx,.p12"
              label="Drop a PFX / P12 file here, or click to browse"
              sublabel="Supports .pfx and .p12 files"
              className="min-h-40"
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(fileBytes.length / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Password
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter PFX password (leave empty if none)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDecrypt()
                      }}
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <Button onClick={handleDecrypt} disabled={loading}>
                    {loading ? (
                      <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileKey className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {loading ? "Decrypting..." : "Decrypt"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorBanner error={error} />}

      {/* End-Entity Certificate */}
      {result?.certificate && (
        <SectionCard icon={ShieldCheck} title="End-Entity Certificate">
          <div className="space-y-2">
            <InfoRow label="Subject" value={result.certificate.subject} />
            <InfoRow label="Issuer" value={result.certificate.issuer} />
            <InfoRow label="Serial Number" value={result.certificate.serial} mono />
            <InfoRow label="Valid From" value={formatDate(result.certificate.notBefore)} />
            <InfoRow label="Valid To" value={formatDate(result.certificate.notAfter)} />
            {certFingerprint && (
              <InfoRow label="SHA-256 Fingerprint" value={certFingerprint} mono />
            )}
            {result.certificate.friendlyName && (
              <InfoRow label="Friendly Name" value={result.certificate.friendlyName} />
            )}
          </div>
          <Separator className="my-3" />
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={result.certificate.pem} label="Certificate PEM copied" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadDer(result.certificate!, `${fileName.replace(/\.[^.]+$/, "")}.cer`)
              }
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">DER (.cer)</span>
            </Button>
          </div>
          <Textarea
            readOnly
            value={result.certificate.pem}
            rows={6}
            className="resize-none font-mono text-[11px] leading-relaxed bg-muted/30 mt-3"
          />
        </SectionCard>
      )}

      {/* Private Key */}
      {result?.privateKeyPem && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-500 shrink-0" />
              <h3 className="text-sm font-medium">Private Key</h3>
              <Badge
                variant="outline"
                className="text-[10px] text-amber-500 border-amber-500/30"
              >
                Sensitive
              </Badge>
              {result.privateKeyAlgo && (
                <Badge variant="secondary" className="text-[10px]">
                  {result.privateKeyAlgo}
                </Badge>
              )}
            </div>
            <Separator />
            <p className="text-[10px] text-amber-500/80">
              Keep this private key secure. It should never be shared or
              transmitted over insecure channels.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(result.privateKeyPem, "Private key PEM copied")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <Textarea
              readOnly
              value={result.privateKeyPem}
              rows={6}
              className="resize-none font-mono text-[11px] leading-relaxed bg-muted/30"
            />
          </CardContent>
        </Card>
      )}

      {/* CA Chain */}
      {result && result.caChain.length > 0 && (
        <>
          {result.caChain.map((ca, i) => (
            <SectionCard
              key={i}
              icon={Link2}
              title={`CA Certificate ${result.caChain.length > 1 ? `#${i + 1}` : ""}`}
            >
              <div className="space-y-2">
                <InfoRow label="Subject" value={ca.subject} />
                <InfoRow label="Issuer" value={ca.issuer} />
                <InfoRow label="Serial Number" value={ca.serial} mono />
                <InfoRow label="Valid From" value={formatDate(ca.notBefore)} />
                <InfoRow label="Valid To" value={formatDate(ca.notAfter)} />
                {ca.friendlyName && (
                  <InfoRow label="Friendly Name" value={ca.friendlyName} />
                )}
              </div>
              <Separator className="my-3" />
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={ca.pem} label={`CA cert #${i + 1} PEM copied`} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadDer(ca, `ca-${i + 1}.cer`)}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">DER (.cer)</span>
                </Button>
              </div>
              <Textarea
                readOnly
                value={ca.pem}
                rows={4}
                className="resize-none font-mono text-[11px] leading-relaxed bg-muted/30 mt-3"
              />
            </SectionCard>
          ))}
        </>
      )}

      {/* Export All */}
      {result && (result.certificate || result.privateKeyPem) && (
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary shrink-0" />
              <h3 className="text-sm font-medium">Export</h3>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {result.certificate && result.caChain.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(buildFullChainPem(), "Full chain PEM copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Full Chain PEM
                </Button>
              )}
              {result.certificate && result.privateKeyPem && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(buildCertKeyPem(), "Cert + Key PEM copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Cert + Key PEM
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolPageLayout>
  )
}
