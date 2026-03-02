import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Braces, Sparkles, Minimize2, CheckCircle } from "lucide-react"
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

export const Route = createFileRoute("/json-formatter")({
  component: JsonFormatterPage,
})

function JsonFormatterPage() {
  const [input, setInput] = useState("")
  const [indent, setIndent] = useState<string>("2")
  const { theme, setTheme, setPreviewTheme, effectiveTheme } = useEditorTheme()

  const getIndent = useCallback(() => {
    if (indent === "tab") return "\t"
    return Number(indent)
  }, [indent])

  const { output, error, setOutput, setError } = useTransform({
    input,
    transform: (val) => {
      const parsed = JSON.parse(val)
      return JSON.stringify(parsed, null, getIndent())
    },
    deps: [getIndent],
  })

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
    <ToolPageLayout
      icon={Braces}
      title="JSON Formatter"
      description="Format, minify, and validate JSON with syntax highlighting."
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
        <Button variant="outline" size="sm" onClick={handleValidate} disabled={!input.trim()}>
          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
          Validate
        </Button>
        <ToolbarTrailing>
          <CopyButton value={output} show={!!output && output !== "// Valid JSON"} />
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
        left={{ label: "Input", value: input, onChange: setInput, language: "json", placeholder: "Paste JSON here..." }}
        right={{ label: "Output", value: output, language: "json", readOnly: true, placeholder: "Formatted output..." }}
        theme={effectiveTheme}
      />
    </ToolPageLayout>
  )
}
