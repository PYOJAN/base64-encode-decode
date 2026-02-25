import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Clock, Copy, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"

export const Route = createFileRoute("/timestamp")({
  component: TimestampPage,
})

function formatRelative(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const absDiff = Math.abs(diff)
  const seconds = Math.floor(absDiff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const suffix = diff >= 0 ? "ago" : "from now"
  if (seconds < 60)
    return `${seconds} second${seconds !== 1 ? "s" : ""} ${suffix}`
  if (minutes < 60)
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ${suffix}`
  if (hours < 24)
    return `${hours} hour${hours !== 1 ? "s" : ""} ${suffix}`
  return `${days} day${days !== 1 ? "s" : ""} ${suffix}`
}

function TimestampPage() {
  const [now, setNow] = useState(Date.now())
  const [tsInput, setTsInput] = useState("")
  const [dateInput, setDateInput] = useState("")
  const { copy } = useClipboard()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const parsedTs = (() => {
    if (!tsInput.trim()) return null
    const num = Number(tsInput.trim())
    if (isNaN(num)) return null
    const ms = num > 1e12 ? num : num * 1000
    return new Date(ms)
  })()
  const tsValid = parsedTs instanceof Date && !isNaN(parsedTs.getTime())

  const parsedDate = dateInput ? new Date(dateInput) : null
  const dateValid = parsedDate instanceof Date && !isNaN(parsedDate.getTime())

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={Clock}
        title="Timestamp Converter"
        description="Convert between Unix timestamps and human-readable dates."
        badge="Utility"
      />

      {/* Current Time */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Current Time
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Unix (seconds)
                </p>
                <p className="mt-1 font-mono text-lg sm:text-2xl font-bold tabular-nums break-all text-foreground">
                  {Math.floor(now / 1000)}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      copy(String(Math.floor(now / 1000)), "Timestamp copied")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Unix (milliseconds)
                </p>
                <p className="mt-1 font-mono text-lg sm:text-2xl font-bold tabular-nums break-all text-foreground">
                  {now}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copy(String(now), "Timestamp copied")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <p className="text-center text-xs font-mono text-muted-foreground">
            {new Date(now).toISOString()}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timestamp to Date */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Timestamp
              </h2>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </h2>
            </div>
            <div>
              <Label htmlFor="ts-input" className="sr-only">
                Timestamp
              </Label>
              <Input
                id="ts-input"
                type="text"
                placeholder="Enter Unix timestamp..."
                value={tsInput}
                onChange={(e) => setTsInput(e.target.value)}
                className="font-mono"
              />
            </div>
            {tsValid && parsedTs && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
                <Row label="ISO 8601" value={parsedTs.toISOString()} />
                <Row
                  label="Locale"
                  value={parsedTs.toLocaleString(undefined, {
                    dateStyle: "full",
                    timeStyle: "long",
                  })}
                />
                <Row label="Relative" value={formatRelative(parsedTs)} />
                <Row
                  label="Timezone"
                  value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                />
              </div>
            )}
            {tsInput.trim() && !tsValid && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-xs text-destructive">
                  Invalid timestamp
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date to Timestamp */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </h2>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Timestamp
              </h2>
            </div>
            <Input
              type="datetime-local"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="font-mono"
            />
            {dateValid && parsedDate && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Seconds
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-bold">
                      {Math.floor(parsedDate.getTime() / 1000)}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          copy(
                            String(Math.floor(parsedDate.getTime() / 1000)),
                            "Copied"
                          )
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Milliseconds
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-bold">
                      {parsedDate.getTime()}
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          copy(String(parsedDate.getTime()), "Copied")
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  )
}
