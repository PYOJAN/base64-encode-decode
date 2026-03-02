import { useState, useCallback, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Table, Copy, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ToolPageLayout,
  Toolbar,
  ToolbarTrailing,
  EditorThemePicker,
  ErrorBanner,
  DualEditorLayout,
} from "@/components"
import { useClipboard, useDebounce, useEditorTheme } from "@/hooks"

export const Route = createFileRoute("/csv-json")({
  component: CsvJsonPage,
})

type Delimiter = "," | ";" | "\t" | "|"

const DELIMITERS: { value: Delimiter; label: string }[] = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab (\\t)" },
  { value: "|", label: "Pipe (|)" },
]

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        fields.push(current)
        current = ""
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

function parseCsv(text: string, delimiter: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]!, delimiter).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!, delimiter)
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (values[j] ?? "").trim()
    }
    rows.push(row)
  }

  return rows
}

function escapeCsvValue(value: string, delimiter: string): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function jsonToCsvText(data: Record<string, unknown>[], delimiter: string): string {
  if (data.length === 0) return ""

  const headers = Object.keys(data[0]!)
  const headerLine = headers.map((h) => escapeCsvValue(h, delimiter)).join(delimiter)

  const rows = data.map((row) =>
    headers.map((h) => escapeCsvValue(String(row[h] ?? ""), delimiter)).join(delimiter)
  )

  return [headerLine, ...rows].join("\n")
}

function CsvJsonPage() {
  const [csv, setCsv] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState("")
  const [delimiter, setDelimiter] = useState<Delimiter>(",")
  const [direction, setDirection] = useState<"csv-to-json" | "json-to-csv">("csv-to-json")
  const { theme, setTheme, setPreviewTheme, effectiveTheme } = useEditorTheme()
  const { copy } = useClipboard()

  const debouncedCsv = useDebounce(csv, 400)
  const debouncedJson = useDebounce(jsonText, 400)

  const convertCsvToJson = useCallback(
    (csvInput: string) => {
      if (!csvInput.trim()) { setJsonText(""); setError(""); return }
      try {
        const rows = parseCsv(csvInput, delimiter)
        if (rows.length === 0) { setError("CSV must have a header row and at least one data row"); setJsonText(""); return }
        setJsonText(JSON.stringify(rows, null, 2)); setError("")
      } catch (e) { setError((e as Error).message); setJsonText("") }
    },
    [delimiter]
  )

  const convertJsonToCsv = useCallback(
    (jsonInput: string) => {
      if (!jsonInput.trim()) { setCsv(""); setError(""); return }
      try {
        const parsed = JSON.parse(jsonInput)
        if (!Array.isArray(parsed)) { setError("JSON must be an array of objects"); setCsv(""); return }
        if (parsed.length === 0) { setError("JSON array is empty"); setCsv(""); return }
        if (typeof parsed[0] !== "object" || parsed[0] === null) { setError("JSON array items must be objects"); setCsv(""); return }
        setCsv(jsonToCsvText(parsed as Record<string, unknown>[], delimiter)); setError("")
      } catch (e) { setError((e as Error).message); setCsv("") }
    },
    [delimiter]
  )

  useEffect(() => {
    if (direction === "csv-to-json") convertCsvToJson(debouncedCsv)
  }, [debouncedCsv, direction, convertCsvToJson])

  useEffect(() => {
    if (direction === "json-to-csv") convertJsonToCsv(debouncedJson)
  }, [debouncedJson, direction, convertJsonToCsv])

  const handleCsvToJson = () => { setDirection("csv-to-json"); convertCsvToJson(csv) }
  const handleJsonToCsv = () => { setDirection("json-to-csv"); convertJsonToCsv(jsonText) }

  return (
    <ToolPageLayout
      icon={Table}
      title="CSV / JSON Converter"
      description="Convert between CSV and JSON formats with support for quoted fields and custom delimiters."
      badge="Text / Data"
    >
      <Toolbar>
        <Button size="sm" onClick={handleCsvToJson} disabled={!csv.trim()}>
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          CSV to JSON
        </Button>
        <Button variant="outline" size="sm" onClick={handleJsonToCsv} disabled={!jsonText.trim()}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          JSON to CSV
        </Button>
        <ToolbarTrailing>
          {csv && (
            <Button variant="ghost" size="sm" onClick={() => copy(csv, "CSV copied")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">CSV</span>
            </Button>
          )}
          {jsonText && (
            <Button variant="ghost" size="sm" onClick={() => copy(jsonText, "JSON copied")}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">JSON</span>
            </Button>
          )}
          <Tabs value={delimiter} onValueChange={(v) => setDelimiter(v as Delimiter)}>
            <TabsList className="h-8">
              {DELIMITERS.map((d) => (
                <TabsTrigger key={d.value} value={d.value} className="text-xs px-2 h-6">
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <EditorThemePicker theme={theme} onThemeChange={setTheme} onPreviewChange={setPreviewTheme} />
        </ToolbarTrailing>
      </Toolbar>

      <ErrorBanner error={error} />

      <DualEditorLayout
        left={{ label: "CSV", value: csv, onChange: setCsv, language: "text", placeholder: "Paste CSV here..." }}
        right={{ label: "JSON", value: jsonText, onChange: setJsonText, language: "json", placeholder: "Paste JSON here..." }}
        theme={effectiveTheme}
      />
    </ToolPageLayout>
  )
}
