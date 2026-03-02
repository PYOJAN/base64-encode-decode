import { useState, useCallback, useEffect, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { FileCode, Copy, ArrowRight, ArrowLeft, Palette } from "lucide-react"
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
import { XMLParser, XMLBuilder } from "fast-xml-parser"

export const Route = createFileRoute("/xml-json")({
  component: XmlJsonPage,
})

function XmlJsonPage() {
  const [xml, setXml] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState("")
  const [direction, setDirection] = useState<
    "json-to-xml" | "xml-to-json"
  >("json-to-xml")
  const [theme, setTheme] = useState<EditorTheme>("dracula")

  const { copy } = useClipboard()

  const debouncedXml = useDebounce(xml, 400)
  const debouncedJson = useDebounce(jsonText, 400)

  const parser = useMemo(
    () =>
      new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        trimValues: true,
      }),
    []
  )

  const builder = useMemo(
    () =>
      new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        format: true,
        indentBy: "  ",
        suppressEmptyNode: false,
      }),
    []
  )

  const convertXmlToJson = useCallback(
    (xmlInput: string) => {
      if (!xmlInput.trim()) {
        setJsonText("")
        setError("")
        return
      }

      try {
        const parsed = parser.parse(xmlInput)
        setJsonText(JSON.stringify(parsed, null, 2))
        setError("")
      } catch (e) {
        setError((e as Error).message)
        setJsonText("")
      }
    },
    [parser]
  )

  const convertJsonToXml = useCallback(
    (jsonInput: string) => {
      if (!jsonInput.trim()) {
        setXml("")
        setError("")
        return
      }

      try {
        const parsed = JSON.parse(jsonInput)
        const builtXml = builder.build(parsed)
        setXml(builtXml)
        setError("")
      } catch (e) {
        setError((e as Error).message)
        setXml("")
      }
    },
    [builder]
  )

  // Auto convert (debounced)
  useEffect(() => {
    if (direction === "json-to-xml") {
      convertJsonToXml(debouncedJson)
    }
  }, [debouncedJson, direction, convertJsonToXml])

  useEffect(() => {
    if (direction === "xml-to-json") {
      convertXmlToJson(debouncedXml)
    }
  }, [debouncedXml, direction, convertXmlToJson])

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] p-3 sm:p-4 gap-3">
      <PageHeader
        icon={FileCode}
        title="XML / JSON Converter"
        description="Auto convert between JSON and XML with attribute support."
        badge="Text / Data"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        {/* LEFT → RIGHT FLOW */}
        <Button
          size="sm"
          onClick={() => setDirection("json-to-xml")}
          disabled={!jsonText.trim()}
        >
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          JSON → XML
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDirection("xml-to-json")}
          disabled={!xml.trim()}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          XML → JSON
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {jsonText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(jsonText, "JSON copied")}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              JSON
            </Button>
          )}

          {xml && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(xml, "XML copied")}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              XML
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
        {/* JSON LEFT */}
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

        {/* XML RIGHT */}
        <div className="flex flex-col min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            XML
          </label>
          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={xml}
              onChange={setXml}
              language="xml"
              placeholder="Paste XML here..."
              fillHeight
              theme={theme}
            />
          </div>
        </div>
      </div>
    </div>
  )
}