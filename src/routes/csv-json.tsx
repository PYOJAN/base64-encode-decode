import { useState, useCallback, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Table, Copy, ArrowRight, ArrowLeft, Palette } from "lucide-react"
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
import { CodeEditor } from "@/components/code-editor"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { type EditorTheme, EDITOR_THEMES } from "@/lib/editor-themes"

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

/** Parse a single CSV line respecting quoted fields. */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip next quote
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

/** Parse full CSV text into an array of objects using first row as headers. */
function parseCsv(
  text: string,
  delimiter: string
): Record<string, string>[] {
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

/** Escape a value for CSV output. Wraps in quotes if it contains the delimiter, quotes, or newlines. */
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

/** Convert an array of objects to CSV text. */
function jsonToCsvText(
  data: Record<string, unknown>[],
  delimiter: string
): string {
  if (data.length === 0) return ""

  const headers = Object.keys(data[0]!)
  const headerLine = headers
    .map((h) => escapeCsvValue(h, delimiter))
    .join(delimiter)

  const rows = data.map((row) =>
    headers
      .map((h) => escapeCsvValue(String(row[h] ?? ""), delimiter))
      .join(delimiter)
  )

  return [headerLine, ...rows].join("\n")
}

function CsvJsonPage() {
  const [csv, setCsv] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [error, setError] = useState("")
  const [delimiter, setDelimiter] = useState<Delimiter>(",")
  const [direction, setDirection] = useState<"csv-to-json" | "json-to-csv">(
    "csv-to-json"
  )
  const [theme, setTheme] = useState<EditorTheme>("dracula")
  const { copy } = useClipboard()

  const debouncedCsv = useDebounce(csv, 400)
  const debouncedJson = useDebounce(jsonText, 400)

  const convertCsvToJson = useCallback(
    (csvInput: string) => {
      if (!csvInput.trim()) {
        setJsonText("")
        setError("")
        return
      }
      try {
        const rows = parseCsv(csvInput, delimiter)
        if (rows.length === 0) {
          setError("CSV must have a header row and at least one data row")
          setJsonText("")
          return
        }
        setJsonText(JSON.stringify(rows, null, 2))
        setError("")
      } catch (e) {
        setError((e as Error).message)
        setJsonText("")
      }
    },
    [delimiter]
  )

  const convertJsonToCsv = useCallback(
    (jsonInput: string) => {
      if (!jsonInput.trim()) {
        setCsv("")
        setError("")
        return
      }
      try {
        const parsed = JSON.parse(jsonInput)
        if (!Array.isArray(parsed)) {
          setError("JSON must be an array of objects")
          setCsv("")
          return
        }
        if (parsed.length === 0) {
          setError("JSON array is empty")
          setCsv("")
          return
        }
        if (typeof parsed[0] !== "object" || parsed[0] === null) {
          setError("JSON array items must be objects")
          setCsv("")
          return
        }
        setCsv(jsonToCsvText(parsed as Record<string, unknown>[], delimiter))
        setError("")
      } catch (e) {
        setError((e as Error).message)
        setCsv("")
      }
    },
    [delimiter]
  )

  // Auto-convert on debounced input change
  useEffect(() => {
    if (direction === "csv-to-json") {
      convertCsvToJson(debouncedCsv)
    }
  }, [debouncedCsv, direction, convertCsvToJson])

  useEffect(() => {
    if (direction === "json-to-csv") {
      convertJsonToCsv(debouncedJson)
    }
  }, [debouncedJson, direction, convertJsonToCsv])

  const handleCsvToJson = () => {
    setDirection("csv-to-json")
    convertCsvToJson(csv)
  }

  const handleJsonToCsv = () => {
    setDirection("json-to-csv")
    convertJsonToCsv(jsonText)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] p-3 sm:p-4 gap-3">
      <PageHeader
        icon={Table}
        title="CSV / JSON Converter"
        description="Convert between CSV and JSON formats with support for quoted fields and custom delimiters."
        badge="Text / Data"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Button size="sm" onClick={handleCsvToJson} disabled={!csv.trim()}>
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          CSV to JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleJsonToCsv}
          disabled={!jsonText.trim()}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          JSON to CSV
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {/* Copy buttons */}
          {csv && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(csv, "CSV copied")}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">CSV</span>
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

          {/* Delimiter selector */}
          <Tabs
            value={delimiter}
            onValueChange={(v) => setDelimiter(v as Delimiter)}
          >
            <TabsList className="h-8">
              {DELIMITERS.map((d) => (
                <TabsTrigger
                  key={d.value}
                  value={d.value}
                  className="text-xs px-2 h-6"
                >
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Theme dropdown */}
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

      {/* Editors -- fill remaining height */}
      <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            CSV
          </label>
          <div className="flex-1 min-h-[200px]">
            <CodeEditor
              value={csv}
              onChange={setCsv}
              language="text"
              placeholder="Paste CSV here..."
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
