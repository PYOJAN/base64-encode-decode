import { useState, useCallback, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileText, Copy, ArrowRight, ArrowLeft, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { CodeEditor } from "@/components/code-editor"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { type EditorTheme, EDITOR_THEMES } from "@/lib/editor-themes"
import YAML from "yaml"

export const Route = createFileRoute("/yaml-json")({
  component: YamlJsonPage,
})

function YamlJsonPage() {
  const [yamlText, setYamlText] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState("")
  const [direction, setDirection] = useState<
    "yaml-to-json" | "json-to-yaml"
  >("yaml-to-json")
  const [theme, setTheme] = useState<EditorTheme>("dracula")

  const { copy } = useClipboard()

  const debouncedYaml = useDebounce(yamlText, 400)
  const debouncedJson = useDebounce(jsonText, 400)

  const convertYamlToJson = useCallback((input: string) => {
    if (!input.trim()) {
      setJsonText("")
      setError("")
      return
    }

    try {
      const parsed = YAML.parse(input)
      setJsonText(JSON.stringify(parsed, null, 2))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setJsonText("")
    }
  }, [])

  const convertJsonToYaml = useCallback((input: string) => {
    if (!input.trim()) {
      setYamlText("")
      setError("")
      return
    }

    try {
      const parsed = JSON.parse(input)
      const yaml = YAML.stringify(parsed)
      setYamlText(yaml)
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setYamlText("")
    }
  }, [])

  // Auto convert
  useEffect(() => {
    if (direction === "yaml-to-json") {
      convertYamlToJson(debouncedYaml)
    }
  }, [debouncedYaml, direction, convertYamlToJson])

  useEffect(() => {
    if (direction === "json-to-yaml") {
      convertJsonToYaml(debouncedJson)
    }
  }, [debouncedJson, direction, convertJsonToYaml])

  const handleYamlToJson = () => {
    setDirection("yaml-to-json")
    convertYamlToJson(yamlText)
  }

  const handleJsonToYaml = () => {
    setDirection("json-to-yaml")
    convertJsonToYaml(jsonText)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] p-3 sm:p-4 gap-3">
      <PageHeader
        icon={FileText}
        title="YAML / JSON Converter"
        description="Convert between YAML and JSON formats with full structure support."
        badge="Text / Data"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Button size="sm" onClick={handleYamlToJson} disabled={!yamlText.trim()}>
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          YAML to JSON
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleJsonToYaml}
          disabled={!jsonText.trim()}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          JSON to YAML
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {yamlText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(yamlText, "YAML copied")}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">YAML</span>
            </Button>
          )}

          {jsonText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(jsonText, "JSON copied")}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">JSON</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">
                  {EDITOR_THEMES.find((t) => t.id === theme)?.label}
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">
                Editor Theme
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(v) => setTheme(v as EditorTheme)}
              >
                {EDITOR_THEMES.map((t) => (
                  <DropdownMenuRadioItem
                    key={t.id}
                    value={t.id}
                    className="text-xs"
                  >
                    {t.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Editors */}
      <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            YAML
          </label>
          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={yamlText}
              onChange={setYamlText}
              language="yaml"
              placeholder="Paste YAML here..."
              fillHeight
              theme={theme}
            />
          </div>
        </div>

        <div className="flex flex-col min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            JSON
          </label>
          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={jsonText}
              onChange={setJsonText}
              language="json"
              placeholder="Paste JSON here..."
              fillHeight
              theme={theme}
            />
          </div>
        </div>
      </div>
    </div>
  )
}