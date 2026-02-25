import { useState, useCallback, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Braces, Copy, Sparkles, Minimize2, CheckCircle, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { CodeEditor } from "@/components/code-editor"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { type EditorTheme, EDITOR_THEMES, getThemeAccentColor } from "@/lib/editor-themes"

export const Route = createFileRoute("/json-formatter")({
  component: JsonFormatterPage,
})

function JsonFormatterPage() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [error, setError] = useState("")
  const [indent, setIndent] = useState<string>("2")
  const [theme, setTheme] = useState<EditorTheme>("dracula")
  const [previewTheme, setPreviewTheme] = useState<EditorTheme | null>(null)
  const effectiveTheme = previewTheme ?? theme
  const { copy } = useClipboard()
  const debouncedInput = useDebounce(input, 400)

  const getIndent = useCallback(() => {
    if (indent === "tab") return "\t"
    return Number(indent)
  }, [indent])

  // Auto-format on input change (debounced)
  useEffect(() => {
    if (!debouncedInput.trim()) {
      setOutput("")
      setError("")
      return
    }
    try {
      const parsed = JSON.parse(debouncedInput)
      setOutput(JSON.stringify(parsed, null, getIndent()))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }, [debouncedInput, getIndent])

  const handleFormat = () => {
    if (!input.trim()) return
    try {
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed, null, getIndent()))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  const handleValidate = () => {
    try {
      JSON.parse(input)
      setError("")
      setOutput("// Valid JSON")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] p-3 sm:p-4 gap-3">
      <PageHeader
        icon={Braces}
        title="JSON Formatter"
        description="Format, minify, and validate JSON with syntax highlighting."
        badge="Formatter"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Button size="sm" onClick={handleFormat} disabled={!input.trim()}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Format
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMinify}
          disabled={!input.trim()}
        >
          <Minimize2 className="mr-1.5 h-3.5 w-3.5" />
          Minify
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={!input.trim()}
        >
          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          Validate
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {output && output !== "// Valid JSON" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(output)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu onOpenChange={(open) => { if (!open) setPreviewTheme(null) }}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">{EDITOR_THEMES.find(t => t.id === theme)?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Editor Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as EditorTheme)}>
                {EDITOR_THEMES.map((t) => (
                  <DropdownMenuRadioItem
                    key={t.id}
                    value={t.id}
                    className="text-xs gap-2"
                    onMouseEnter={() => setPreviewTheme(t.id)}
                    onMouseLeave={() => setPreviewTheme(null)}
                  >
                    <span className="inline-block h-3 w-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: getThemeAccentColor(t.id) }} />
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tabs value={indent} onValueChange={setIndent}>
            <TabsList className="h-8">
              <TabsTrigger value="2" className="text-xs px-2 h-6">2sp</TabsTrigger>
              <TabsTrigger value="4" className="text-xs px-2 h-6">4sp</TabsTrigger>
              <TabsTrigger value="tab" className="text-xs px-2 h-6">Tab</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 shrink-0">
          <div className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
          <p className="text-xs text-destructive font-mono break-all truncate">
            {error}
          </p>
        </div>
      )}

      {/* Editors — fill remaining height */}
      <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Input
          </label>
          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={input}
              onChange={setInput}
              language="json"
              placeholder="Paste JSON here..."
              fillHeight
              theme={effectiveTheme}
            />
          </div>
        </div>
        <div className="flex flex-col min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Output
          </label>
          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={output}
              language="json"
              readOnly
              placeholder="Formatted output..."
              fillHeight
              theme={effectiveTheme}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
