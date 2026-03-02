import { useState, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { SearchCode, Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ToolPageLayout, ErrorBanner } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"

export const Route = createFileRoute("/regex-tester")({
  component: RegexTesterPage,
})

interface MatchResult {
  index: number
  match: string
  groups: string[]
}

function RegexTesterPage() {
  const [pattern, setPattern] = useState("")
  const [testString, setTestString] = useState("")
  const [flagG, setFlagG] = useState(true)
  const [flagI, setFlagI] = useState(false)
  const [flagM, setFlagM] = useState(false)
  const [flagS, setFlagS] = useState(false)
  const { copy } = useClipboard()

  const debouncedPattern = useDebounce(pattern, 300)
  const debouncedTestString = useDebounce(testString, 300)

  const flags = useMemo(() => {
    let f = ""
    if (flagG) f += "g"
    if (flagI) f += "i"
    if (flagM) f += "m"
    if (flagS) f += "s"
    return f
  }, [flagG, flagI, flagM, flagS])

  const { regex, error, matches } = useMemo(() => {
    if (!debouncedPattern.trim()) {
      return { regex: null, error: "", matches: [] as MatchResult[] }
    }

    let re: RegExp
    try {
      re = new RegExp(debouncedPattern, flags)
    } catch (e) {
      return {
        regex: null,
        error: (e as Error).message,
        matches: [] as MatchResult[],
      }
    }

    if (!debouncedTestString) {
      return { regex: re, error: "", matches: [] as MatchResult[] }
    }

    const results: MatchResult[] = []

    if (flags.includes("g")) {
      let m: RegExpExecArray | null
      // Reset lastIndex to avoid infinite loops on zero-length matches
      re.lastIndex = 0
      while ((m = re.exec(debouncedTestString)) !== null) {
        results.push({
          index: m.index,
          match: m[0],
          groups: m.slice(1),
        })
        // Prevent infinite loop on zero-length matches
        if (m[0].length === 0) {
          re.lastIndex++
        }
        if (results.length >= 1000) break
      }
    } else {
      const m = re.exec(debouncedTestString)
      if (m) {
        results.push({
          index: m.index,
          match: m[0],
          groups: m.slice(1),
        })
      }
    }

    return { regex: re, error: "", matches: results }
  }, [debouncedPattern, debouncedTestString, flags])

  // Build highlighted text with matches
  const highlightedText = useMemo(() => {
    if (!debouncedTestString || matches.length === 0) return null

    const MATCH_COLORS = [
      "bg-emerald-500/30 text-emerald-300 border-b border-emerald-400",
      "bg-blue-500/30 text-blue-300 border-b border-blue-400",
      "bg-purple-500/30 text-purple-300 border-b border-purple-400",
      "bg-yellow-500/30 text-yellow-300 border-b border-yellow-400",
      "bg-pink-500/30 text-pink-300 border-b border-pink-400",
      "bg-cyan-500/30 text-cyan-300 border-b border-cyan-400",
    ]

    const parts: { text: string; isMatch: boolean; colorIndex: number }[] = []
    let lastIndex = 0

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!
      if (m.index > lastIndex) {
        parts.push({
          text: debouncedTestString.slice(lastIndex, m.index),
          isMatch: false,
          colorIndex: 0,
        })
      }
      parts.push({
        text: m.match,
        isMatch: true,
        colorIndex: i % MATCH_COLORS.length,
      })
      lastIndex = m.index + m.match.length
    }

    if (lastIndex < debouncedTestString.length) {
      parts.push({
        text: debouncedTestString.slice(lastIndex),
        isMatch: false,
        colorIndex: 0,
      })
    }

    return (
      <pre className="whitespace-pre-wrap break-all font-mono text-sm text-muted-foreground leading-relaxed">
        {parts.map((part, i) =>
          part.isMatch ? (
            <span key={i} className={`rounded-sm px-0.5 ${MATCH_COLORS[part.colorIndex]}`}>
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </pre>
    )
  }, [debouncedTestString, matches])

  return (
    <ToolPageLayout
      variant="scroll"
      icon={SearchCode}
      title="Regex Tester"
      description="Test regular expressions with real-time match highlighting and group extraction."
      badge="Text / Data"
    >

      {/* Pattern input */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="regex-pattern" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pattern
            </Label>
            <div className="flex items-center gap-0">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted/50 px-3 text-sm font-mono text-muted-foreground">
                /
              </span>
              <Input
                id="regex-pattern"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Enter regex pattern..."
                className="rounded-none border-x-0 font-mono"
              />
              <span className="flex h-9 items-center rounded-r-md border border-l-0 bg-muted/50 px-3 text-sm font-mono text-muted-foreground">
                /{flags}
              </span>
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Flags
            </span>
            {[
              { label: "g", desc: "Global", checked: flagG, onChange: setFlagG },
              { label: "i", desc: "Case insensitive", checked: flagI, onChange: setFlagI },
              { label: "m", desc: "Multiline", checked: flagM, onChange: setFlagM },
              { label: "s", desc: "Dotall", checked: flagS, onChange: setFlagS },
            ].map((flag) => (
              <label
                key={flag.label}
                className="flex items-center gap-1.5 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={flag.checked}
                  onChange={(e) => flag.onChange(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-muted-foreground accent-primary"
                />
                <span className="font-mono text-sm font-semibold text-foreground">
                  {flag.label}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {flag.desc}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      <ErrorBanner error={error} />

      {/* Test string */}
      <Card>
        <CardContent className="p-6 space-y-2">
          <Label htmlFor="test-string" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Test String
          </Label>
          <Textarea
            id="test-string"
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="Enter test string..."
            rows={6}
            className="resize-none font-mono"
          />
        </CardContent>
      </Card>

      {/* Results */}
      {regex && debouncedTestString && (
        <div className="space-y-4">
          {/* Match count */}
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs font-mono">
              {matches.length} match{matches.length !== 1 ? "es" : ""}
            </Badge>
            {matches.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copy(
                    matches.map((m) => m.match).join("\n"),
                    "All matches copied"
                  )
                }
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy all matches
              </Button>
            )}
          </div>

          {/* Highlighted text */}
          {highlightedText && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Highlighted Matches
                </p>
                <div className="rounded-lg border bg-muted/20 p-4 max-h-64 overflow-auto">
                  {highlightedText}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match details */}
          {matches.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Match Details
                </p>
                <div className="max-h-80 overflow-auto space-y-2">
                  {matches.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                    >
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-mono mt-0.5">
                        #{i + 1}
                      </Badge>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-foreground break-all select-all">
                            {m.match || <span className="text-muted-foreground italic">(empty)</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            index {m.index}
                          </span>
                        </div>
                        {m.groups.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {m.groups.map((g, gi) => (
                              <span
                                key={gi}
                                className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono"
                              >
                                <span className="text-muted-foreground">
                                  ${gi + 1}:
                                </span>
                                <span className="text-foreground">
                                  {g ?? "undefined"}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7"
                            onClick={() => copy(m.match, `Match #${i + 1} copied`)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ToolPageLayout>
  )
}
