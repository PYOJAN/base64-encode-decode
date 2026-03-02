import { useState, useCallback, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileText, Copy, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ToolPageLayout,
  Toolbar,
  ToolbarTrailing,
  EditorThemePicker,
  ErrorBanner,
  DualEditorLayout,
} from "@/components"
import { useClipboard, useDebounce, useEditorTheme } from "@/hooks"
import YAML from "yaml"

export const Route = createFileRoute("/yaml-json")({
  component: YamlJsonPage,
})

function YamlJsonPage() {
  const [yamlText, setYamlText] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState("")
  const [direction, setDirection] = useState<"yaml-to-json" | "json-to-yaml">("yaml-to-json")
  const { theme, setTheme, setPreviewTheme, effectiveTheme } = useEditorTheme()
  const { copy } = useClipboard()

  const debouncedYaml = useDebounce(yamlText, 400)
  const debouncedJson = useDebounce(jsonText, 400)

  const convertYamlToJson = useCallback((input: string) => {
    if (!input.trim()) { setJsonText(""); setError(""); return }
    try {
      const parsed = YAML.parse(input)
      setJsonText(JSON.stringify(parsed, null, 2)); setError("")
    } catch (e) { setError((e as Error).message); setJsonText("") }
  }, [])

  const convertJsonToYaml = useCallback((input: string) => {
    if (!input.trim()) { setYamlText(""); setError(""); return }
    try {
      const parsed = JSON.parse(input)
      setYamlText(YAML.stringify(parsed)); setError("")
    } catch (e) { setError((e as Error).message); setYamlText("") }
  }, [])

  useEffect(() => {
    if (direction === "yaml-to-json") convertYamlToJson(debouncedYaml)
  }, [debouncedYaml, direction, convertYamlToJson])

  useEffect(() => {
    if (direction === "json-to-yaml") convertJsonToYaml(debouncedJson)
  }, [debouncedJson, direction, convertJsonToYaml])

  const handleYamlToJson = () => { setDirection("yaml-to-json"); convertYamlToJson(yamlText) }
  const handleJsonToYaml = () => { setDirection("json-to-yaml"); convertJsonToYaml(jsonText) }

  return (
    <ToolPageLayout
      icon={FileText}
      title="YAML / JSON Converter"
      description="Convert between YAML and JSON formats with full structure support."
      badge="Text / Data"
    >
      <Toolbar>
        <Button size="sm" onClick={handleYamlToJson} disabled={!yamlText.trim()}>
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          YAML to JSON
        </Button>
        <Button variant="outline" size="sm" onClick={handleJsonToYaml} disabled={!jsonText.trim()}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          JSON to YAML
        </Button>
        <ToolbarTrailing>
          {yamlText && (
            <Button variant="ghost" size="sm" onClick={() => copy(yamlText, "YAML copied")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">YAML</span>
            </Button>
          )}
          {jsonText && (
            <Button variant="ghost" size="sm" onClick={() => copy(jsonText, "JSON copied")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">JSON</span>
            </Button>
          )}
          <EditorThemePicker theme={theme} onThemeChange={setTheme} onPreviewChange={setPreviewTheme} />
        </ToolbarTrailing>
      </Toolbar>

      <ErrorBanner error={error} />

      <DualEditorLayout
        left={{ label: "YAML", value: yamlText, onChange: setYamlText, language: "yaml", placeholder: "Paste YAML here..." }}
        right={{ label: "JSON", value: jsonText, onChange: setJsonText, language: "json", placeholder: "Paste JSON here..." }}
        theme={effectiveTheme}
      />
    </ToolPageLayout>
  )
}
