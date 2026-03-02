import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Binary, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToolPageLayout, ErrorBanner } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"

export const Route = createFileRoute("/number-base")({
  component: NumberBasePage,
})

type Base = "bin" | "oct" | "dec" | "hex"

const BASES: { key: Base; label: string; radix: number; color: string; prefix: string }[] = [
  { key: "bin", label: "Binary", radix: 2, color: "text-emerald-400", prefix: "0b" },
  { key: "oct", label: "Octal", radix: 8, color: "text-yellow-400", prefix: "0o" },
  { key: "dec", label: "Decimal", radix: 10, color: "text-blue-400", prefix: "" },
  { key: "hex", label: "Hexadecimal", radix: 16, color: "text-purple-400", prefix: "0x" },
]

function parseToBigInt(str: string, radix: number): bigint {
  const cleaned = str.trim().toLowerCase()
  if (!cleaned) throw new Error("Empty input")

  if (radix === 10) {
    if (!/^-?\d+$/.test(cleaned)) throw new Error("Invalid decimal number")
    return BigInt(cleaned)
  }
  if (radix === 2) {
    if (!/^-?[01]+$/.test(cleaned)) throw new Error("Invalid binary number")
    const negative = cleaned.startsWith("-")
    const abs = negative ? cleaned.slice(1) : cleaned
    const val = BigInt("0b" + abs)
    return negative ? -val : val
  }
  if (radix === 8) {
    if (!/^-?[0-7]+$/.test(cleaned)) throw new Error("Invalid octal number")
    const negative = cleaned.startsWith("-")
    const abs = negative ? cleaned.slice(1) : cleaned
    const val = BigInt("0o" + abs)
    return negative ? -val : val
  }
  if (radix === 16) {
    if (!/^-?[0-9a-f]+$/.test(cleaned)) throw new Error("Invalid hexadecimal number")
    const negative = cleaned.startsWith("-")
    const abs = negative ? cleaned.slice(1) : cleaned
    const val = BigInt("0x" + abs)
    return negative ? -val : val
  }
  throw new Error("Unsupported radix")
}

function bigIntToString(value: bigint, radix: number): string {
  if (value < 0n) {
    return "-" + (-value).toString(radix)
  }
  return value.toString(radix)
}

function NumberBasePage() {
  const [inputBase, setInputBase] = useState<Base>("dec")
  const [input, setInput] = useState("")
  const { copy } = useClipboard()

  const debouncedInput = useDebounce(input, 300)
  const trimmed = debouncedInput.trim()

  const currentBase = BASES.find((b) => b.key === inputBase)!

  let parsedValue: bigint | null = null
  let error = ""

  if (trimmed) {
    try {
      parsedValue = parseToBigInt(trimmed, currentBase.radix)
    } catch (e) {
      error = (e as Error).message
    }
  }

  const results =
    parsedValue !== null
      ? BASES.map((base) => ({
          ...base,
          value: bigIntToString(parsedValue!, base.radix),
        }))
      : null

  const handleBaseChange = (value: string) => {
    setInputBase(value as Base)
    setInput("")
  }

  const placeholders: Record<Base, string> = {
    bin: "e.g. 101010",
    oct: "e.g. 52",
    dec: "e.g. 42",
    hex: "e.g. 2a",
  }

  return (
    <ToolPageLayout
      variant="scroll"
      icon={Binary}
      title="Number Base Converter"
      description="Convert numbers between binary, octal, decimal, and hexadecimal bases. Supports arbitrarily large numbers."
      badge="Encode / Decode"
    >

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Input Base
            </h2>
            <Tabs value={inputBase} onValueChange={handleBaseChange}>
              <TabsList className="w-full sm:w-auto">
                {BASES.map((base) => (
                  <TabsTrigger
                    key={base.key}
                    value={base.key}
                    className="flex-1 sm:flex-none"
                  >
                    {base.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Value
            </h2>
            <Input
              type="text"
              placeholder={placeholders[inputBase]}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-mono text-sm"
            />
            {trimmed && !error && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">
                  Valid {currentBase.label.toLowerCase()} number
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono ml-auto"
                >
                  {trimmed.length} digits
                </Badge>
              </div>
            )}
          </div>

          <ErrorBanner error={error} />
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-3">
          {results.map((base) => (
            <Card key={base.key}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex flex-col items-center gap-0.5 w-12 shrink-0">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${base.color}`}
                  >
                    {base.label.slice(0, 3)}
                  </span>
                  {base.prefix && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {base.prefix}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {base.label}
                  </p>
                  <p className="truncate font-mono text-sm text-foreground select-all break-all">
                    {base.value}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        copy(base.value, `${base.label} value copied`)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ToolPageLayout>
  )
}
