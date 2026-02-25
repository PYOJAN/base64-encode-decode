import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  KeyRound,
  ClipboardPaste,
  Trash2,
  Upload,
  Copy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  User,
  Globe,
  Calendar,
  Shield,
} from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { decodeJwt, getExpiryStatus, type JwtParts } from "@/utils/jwt"

export const Route = createFileRoute("/jwt-decoder")({
  component: JwtDecoderPage,
})

// ── Standard JWT claims ──

const STANDARD_CLAIMS: Record<string, { label: string; icon: typeof Clock }> = {
  iss: { label: "Issuer", icon: Globe },
  sub: { label: "Subject", icon: User },
  aud: { label: "Audience", icon: Shield },
  exp: { label: "Expiration Time", icon: Clock },
  iat: { label: "Issued At", icon: Calendar },
  nbf: { label: "Not Before", icon: Calendar },
}

// ── Page ──

function JwtDecoderPage() {
  const [input, setInput] = useState("")
  const [result, setResult] = useState<JwtParts | null>(null)
  const [error, setError] = useState("")
  const { paste, copy } = useClipboard()

  const debounced = useDebounce(input, 300)

  useEffect(() => {
    if (!debounced.trim()) {
      setResult(null)
      setError("")
      return
    }
    try {
      const decoded = decodeJwt(debounced)
      setResult(decoded)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decode JWT")
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
      setInput(new TextDecoder().decode(reader.result as ArrayBuffer))
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ""
  }

  const expiryStatus = result ? getExpiryStatus(result.payload) : null

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={KeyRound}
        title="JWT Decoder"
        description="Decode and inspect JSON Web Tokens. All processing happens locally in your browser."
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
                  accept=".jwt,.txt,.json"
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
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIi..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
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
      {result && expiryStatus && (
        <div className="space-y-4">
          {/* Expiry Status Banner */}
          <ExpiryBanner status={expiryStatus} />

          {/* Standard Claims */}
          <StandardClaimsCard payload={result.payload} copy={copy} />

          {/* Header */}
          <JsonCard
            title="Header"
            json={result.header}
            copy={copy}
          />

          {/* Payload */}
          <JsonCard
            title="Payload"
            json={result.payload}
            copy={copy}
          />

          {/* Signature */}
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="text-sm font-medium">Signature</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(result.signatureHex, "Signature copied")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
              <Separator />
              <ScrollArea className="max-h-32">
                <p className="font-mono text-[11px] text-muted-foreground break-all leading-relaxed">
                  {result.signatureHex}
                </p>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── Expiry Banner ──

function ExpiryBanner({
  status,
}: {
  status: ReturnType<typeof getExpiryStatus>
}) {
  const isValid = status.status === "valid"
  const isExpired = status.status === "expired"
  const noExpiry = status.status === "no-expiry"

  return (
    <Card
      className={
        isValid
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isExpired
            ? "border-destructive/30 bg-destructive/5"
            : "border-muted-foreground/20 bg-muted/5"
      }
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {isValid ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : isExpired ? (
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <MinusCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">
                {isValid
                  ? "Token is valid"
                  : isExpired
                    ? "Token is expired"
                    : "No expiry set"}
              </p>
              <Badge
                variant={isValid ? "secondary" : isExpired ? "destructive" : "outline"}
                className="text-[10px] shrink-0"
              >
                {isValid ? "Valid" : isExpired ? "Expired" : "No Expiry"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status.expiresAt && (
                <>Expires: {status.expiresAt.toLocaleString()}</>
              )}
              {status.issuedAt && (
                <>
                  {status.expiresAt ? " · " : ""}
                  Issued: {status.issuedAt.toLocaleString()}
                </>
              )}
              {noExpiry && !status.issuedAt && "This token has no expiration claim (exp)."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Standard Claims Card ──

function StandardClaimsCard({
  payload,
  copy,
}: {
  payload: Record<string, unknown>
  copy: (text: string, label?: string) => Promise<void>
}) {
  const claims = Object.entries(STANDARD_CLAIMS).filter(
    ([key]) => payload[key] !== undefined
  )

  if (claims.length === 0) return null

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-medium">Standard Claims</h3>
        </div>
        <Separator />
        <div className="space-y-2">
          {claims.map(([key, { label, icon: Icon }]) => {
            const raw = payload[key]
            const isTimestamp = ["exp", "iat", "nbf"].includes(key) && typeof raw === "number"
            const displayValue = isTimestamp
              ? `${new Date(raw * 1000).toLocaleString()} (${raw})`
              : typeof raw === "string"
                ? raw
                : JSON.stringify(raw)

            return (
              <div key={key} className="flex items-start gap-3 text-xs group">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground w-32 shrink-0 pt-0.5">
                  {label}
                  <Badge variant="outline" className="ml-1.5 text-[9px] font-mono px-1 py-0">
                    {key}
                  </Badge>
                </span>
                <span className="break-all flex-1 font-mono text-[11px]">
                  {displayValue}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => copy(String(displayValue), `${label} copied`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ── JSON Card ──

function JsonCard({
  title,
  json,
  copy,
}: {
  title: string
  json: Record<string, unknown>
  copy: (text: string, label?: string) => Promise<void>
}) {
  const formatted = JSON.stringify(json, null, 2)

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copy(formatted, `${title} JSON copied`)}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
        <Separator />
        <ScrollArea className="max-h-64">
          <pre className="rounded-md border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
            {formatted}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
