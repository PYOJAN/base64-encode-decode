import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileJson, Sparkles, Minimize2, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ToolPageLayout,
  Toolbar,
  ToolbarTrailing,
  CopyButton,
  EditorThemePicker,
  ErrorBanner,
  DualEditorLayout,
} from "@/components"
import { useEditorTheme, useTransform } from "@/hooks"
import yaml from "js-yaml"

export const Route = createFileRoute("/yaml-formatter")({
  component: YamlFormatterPage,
})

function YamlFormatterPage() {
  const [input, setInput] = useState("")
  const [indent, setIndent] = useState<string>("2")
  const { theme, setTheme, setPreviewTheme, effectiveTheme } = useEditorTheme()

  const getIndent = useCallback(() => {
    if (indent === "tab") return 2
    return Number(indent)
  }, [indent])

  const { output, error, setOutput, setError } = useTransform({
    input,
    transform: (val) => {
      const parsed = yaml.load(val)
      return yaml.dump(parsed, { indent: getIndent() })
    },
    deps: [getIndent],
  })

  const handleFormat = () => {
    if (!input.trim()) return
    try {
      const parsed = yaml.load(input)
      setOutput(yaml.dump(parsed, { indent: getIndent() }))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  const handleMinify = () => {
    if (!input.trim()) return
    try {
      const parsed = yaml.load(input)
      setOutput(yaml.dump(parsed, { flowLevel: 0 }))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  const handleYamlToJson = () => {
    if (!input.trim()) return
    try {
      const parsed = yaml.load(input)
      setOutput(JSON.stringify(parsed, null, getIndent()))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  const handleJsonToYaml = () => {
    if (!input.trim()) return
    try {
      const parsed = JSON.parse(input)
      setOutput(yaml.dump(parsed, { indent: getIndent() }))
      setError("")
    } catch (e) {
      setError((e as Error).message)
      setOutput("")
    }
  }

  return (
    <ToolPageLayout
      icon={FileJson}
      title="YAML Formatter"
      description="Format, minify, and convert YAML with syntax highlighting."
      badge="Formatter"
    >
      <Toolbar>
        <Button size="sm" onClick={handleFormat} disabled={!input.trim()}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Format
        </Button>
        <Button variant="outline" size="sm" onClick={handleMinify} disabled={!input.trim()}>
          <Minimize2 className="mr-1.5 h-3.5 w-3.5" />
          Minify
        </Button>
        <Button variant="outline" size="sm" onClick={handleYamlToJson} disabled={!input.trim()}>
          <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
          YAML &rarr; JSON
        </Button>
        <Button variant="outline" size="sm" onClick={handleJsonToYaml} disabled={!input.trim()}>
          <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
          JSON &rarr; YAML
        </Button>
        <ToolbarTrailing>
          <CopyButton value={output} />
          <EditorThemePicker theme={theme} onThemeChange={setTheme} onPreviewChange={setPreviewTheme} />
          <Tabs value={indent} onValueChange={setIndent}>
            <TabsList className="h-8">
              <TabsTrigger value="2" className="text-xs px-2 h-6">2sp</TabsTrigger>
              <TabsTrigger value="4" className="text-xs px-2 h-6">4sp</TabsTrigger>
              <TabsTrigger value="tab" className="text-xs px-2 h-6">Tab</TabsTrigger>
            </TabsList>
          </Tabs>
        </ToolbarTrailing>
      </Toolbar>

      <ErrorBanner error={error} />

      <DualEditorLayout
        left={{ label: "Input", value: input, onChange: setInput, language: "yaml", placeholder: "Paste YAML or JSON here..." }}
        right={{ label: "Output", value: output, language: "yaml", readOnly: true, placeholder: "Formatted output..." }}
        theme={effectiveTheme}
      />
    </ToolPageLayout>
  )
}
