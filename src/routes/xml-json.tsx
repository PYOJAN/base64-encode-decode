import { useState, useCallback, useEffect, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileCode, Copy, ArrowRight, ArrowLeft } from "lucide-react"
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
import { XMLParser, XMLBuilder } from "fast-xml-parser"

export const Route = createFileRoute("/xml-json")({
  component: XmlJsonPage,
})

function XmlJsonPage() {
  const [xml, setXml] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState("")
  const [direction, setDirection] = useState<"json-to-xml" | "xml-to-json">("json-to-xml")
  const { theme, setTheme, setPreviewTheme, effectiveTheme } = useEditorTheme()
  const { copy } = useClipboard()

  const debouncedXml = useDebounce(xml, 400)
  const debouncedJson = useDebounce(jsonText, 400)

  const parser = useMemo(
    () => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true }),
    []
  )

  const builder = useMemo(
    () => new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", format: true, indentBy: "  ", suppressEmptyNode: false }),
    []
  )

  const convertXmlToJson = useCallback(
    (xmlInput: string) => {
      if (!xmlInput.trim()) { setJsonText(""); setError(""); return }
      try {
        const parsed = parser.parse(xmlInput)
        setJsonText(JSON.stringify(parsed, null, 2)); setError("")
      } catch (e) { setError((e as Error).message); setJsonText("") }
    },
    [parser]
  )

  const convertJsonToXml = useCallback(
    (jsonInput: string) => {
      if (!jsonInput.trim()) { setXml(""); setError(""); return }
      try {
        const parsed = JSON.parse(jsonInput)
        setXml(builder.build(parsed)); setError("")
      } catch (e) { setError((e as Error).message); setXml("") }
    },
    [builder]
  )

  useEffect(() => {
    if (direction === "json-to-xml") convertJsonToXml(debouncedJson)
  }, [debouncedJson, direction, convertJsonToXml])

  useEffect(() => {
    if (direction === "xml-to-json") convertXmlToJson(debouncedXml)
  }, [debouncedXml, direction, convertXmlToJson])

  return (
    <ToolPageLayout
      icon={FileCode}
      title="XML / JSON Converter"
      description="Auto convert between JSON and XML with attribute support."
      badge="Text / Data"
    >
      <Toolbar>
        <Button size="sm" onClick={() => setDirection("json-to-xml")} disabled={!jsonText.trim()}>
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          JSON → XML
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDirection("xml-to-json")} disabled={!xml.trim()}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          XML → JSON
        </Button>
        <ToolbarTrailing>
          {jsonText && (
            <Button variant="ghost" size="sm" onClick={() => copy(jsonText, "JSON copied")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              JSON
            </Button>
          )}
          {xml && (
            <Button variant="ghost" size="sm" onClick={() => copy(xml, "XML copied")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              XML
            </Button>
          )}
          <EditorThemePicker theme={theme} onThemeChange={setTheme} onPreviewChange={setPreviewTheme} />
        </ToolbarTrailing>
      </Toolbar>

      <ErrorBanner error={error} />

      <DualEditorLayout
        left={{ label: "JSON", value: jsonText, onChange: setJsonText, language: "json", placeholder: "Paste JSON here..." }}
        right={{ label: "XML", value: xml, onChange: setXml, language: "xml", placeholder: "Paste XML here..." }}
        theme={effectiveTheme}
      />
    </ToolPageLayout>
  )
}
