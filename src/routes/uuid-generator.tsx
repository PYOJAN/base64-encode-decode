import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Fingerprint, Copy, CopyPlus, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"

export const Route = createFileRoute("/uuid-generator")({
  component: UuidGeneratorPage,
})

type UuidVersion = "v4" | "v7"

function generateUUIDv4(): string {
  return crypto.randomUUID()
}

function generateUUIDv7(): string {
  const timestamp = Date.now()

  // 48-bit timestamp in milliseconds
  const tsHex = timestamp.toString(16).padStart(12, "0")

  // Random bytes for the rest
  const randomBytes = new Uint8Array(10)
  crypto.getRandomValues(randomBytes)

  // Build the UUID:
  // xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
  // where x is timestamp/random and 7 is the version
  const timeLow = tsHex.slice(0, 8)
  const timeMid = tsHex.slice(8, 12)

  // Version 7: set high nibble of 7th octet to 0111
  const randA = (randomBytes[0]! & 0x0f).toString(16) +
    randomBytes[1]!.toString(16).padStart(2, "0")

  // Variant bits: set high bits of 9th octet to 10xx
  const variantByte = (randomBytes[2]! & 0x3f) | 0x80
  const randB =
    variantByte.toString(16).padStart(2, "0") +
    randomBytes[3]!.toString(16).padStart(2, "0") +
    randomBytes[4]!.toString(16).padStart(2, "0") +
    randomBytes[5]!.toString(16).padStart(2, "0") +
    randomBytes[6]!.toString(16).padStart(2, "0") +
    randomBytes[7]!.toString(16).padStart(2, "0")

  return `${timeLow}-${timeMid}-7${randA}-${randB.slice(0, 4)}-${randB.slice(4)}${randomBytes[8]!.toString(16).padStart(2, "0")}${randomBytes[9]!.toString(16).padStart(2, "0")}`
}

function UuidGeneratorPage() {
  const [version, setVersion] = useState<UuidVersion>("v4")
  const [uppercase, setUppercase] = useState(false)
  const [uuids, setUuids] = useState<string[]>([])
  const { copy } = useClipboard()

  const generate = useCallback(
    (count: number) => {
      const generator = version === "v4" ? generateUUIDv4 : generateUUIDv7
      const newUuids = Array.from({ length: count }, () => generator())
      setUuids((prev) => [...newUuids, ...prev])
    },
    [version]
  )

  const displayUuids = uppercase
    ? uuids.map((u) => u.toUpperCase())
    : uuids

  const handleCopyAll = () => {
    copy(displayUuids.join("\n"), `${displayUuids.length} UUIDs copied`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={Fingerprint}
        title="UUID Generator"
        description="Generate random UUIDs (v4) or timestamp-based UUIDs (v7) in bulk."
        badge="Generator"
      />

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Version tabs */}
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={version}
              onValueChange={(v) => setVersion(v as UuidVersion)}
            >
              <TabsList>
                <TabsTrigger value="v4">UUID v4</TabsTrigger>
                <TabsTrigger value="v7">UUID v7</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant={uppercase ? "secondary" : "outline"}
              size="sm"
              onClick={() => setUppercase((prev) => !prev)}
              className="text-xs font-mono"
            >
              {uppercase ? "UPPERCASE" : "lowercase"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {version === "v4"
              ? "Version 4 UUIDs are randomly generated using crypto.randomUUID()."
              : "Version 7 UUIDs encode a Unix timestamp in the first 48 bits, followed by random data."}
          </p>

          {/* Generate buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => generate(1)}>
              Generate 1
            </Button>
            <Button variant="outline" size="sm" onClick={() => generate(5)}>
              Generate 5
            </Button>
            <Button variant="outline" size="sm" onClick={() => generate(10)}>
              Generate 10
            </Button>

            <div className="ml-auto flex gap-2">
              {uuids.length > 0 && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyAll}
                      >
                        <CopyPlus className="mr-1 h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Copy All</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy all</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUuids([])}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UUID List */}
      {uuids.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Generated UUIDs
              </p>
              <span className="text-xs text-muted-foreground font-mono">
                {uuids.length} {uuids.length === 1 ? "item" : "items"}
              </span>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {displayUuids.map((uuid, index) => (
                  <div
                    key={`${uuids.length - index}-${uuid}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
                  >
                    <span className="text-[10px] text-muted-foreground font-mono w-6 shrink-0 text-right tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-mono text-sm text-foreground select-all break-all">
                      {uuid}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copy(uuid, "UUID copied")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
