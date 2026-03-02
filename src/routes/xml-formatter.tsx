import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileCode, Sparkles, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

export const Route = createFileRoute("/xml-formatter")({
  component: XmlFormatterPage,
})

function formatXml(xml: string, indent = "  "): string {
  let formatted = ""
  let pad = 0
  const lines = xml
    .replace(/(>)(<)(\/*)/g, "$1\n$2$3")
    .split("\n")
    .filter((line) => line.trim())

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.match(/^<\/\w/)) pad--
    formatted += indent.repeat(Math.max(0, pad)) + line + "\n"
    if (line.match(/^<\w[^>]*[^/]>.*$/) && !line.match(/^<\w[^>]*>.*<\/\w/)) {
      pad++
    }
  }
  return formatted.trimEnd()
}

function minifyXml(xml: string): string {
  return xml
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function validateXml(xml: string): string | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "application/xml")
  const errorNode = doc.querySelector("parsererror")
  return errorNode ? (errorNode.textContent ?? "Invalid XML") : null
}

function XmlFormatterPage() {
  const [input, setInput] = useState("")
  const { theme, setTheme, setPreviewTheme, effectiveTheme } = useEditorTheme()

  const { output, error, setOutput, setError } = useTransform({
    input,
    transform: (val) => {
      const err = validateXml(val)
      if (err) throw new Error(err)
      return formatXml(val)
    },
  })

  const handleFormat = () => {
    const err = validateXml(input)
    if (err) {
      setError(err)
      setOutput("")
      return
    }
    setOutput(formatXml(input))
    setError("")
  }

  const handleMinify = () => {
    const err = validateXml(input)
    if (err) {
      setError(err)
      setOutput("")
      return
    }
    setOutput(minifyXml(input))
    setError("")
  }

  return (
    <ToolPageLayout
      icon={FileCode}
      title="XML Formatter"
      description="Format and minify XML documents with syntax highlighting."
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
        <ToolbarTrailing>
          <CopyButton value={output} />
          <EditorThemePicker theme={theme} onThemeChange={setTheme} onPreviewChange={setPreviewTheme} />
        </ToolbarTrailing>
      </Toolbar>

      <ErrorBanner error={error} />

      <DualEditorLayout
        left={{ label: "Input", value: input, onChange: setInput, language: "xml", placeholder: "Paste XML here..." }}
        right={{ label: "Output", value: output, language: "xml", readOnly: true, placeholder: "Formatted output..." }}
        theme={effectiveTheme}
      />
    </ToolPageLayout>
  )
}
