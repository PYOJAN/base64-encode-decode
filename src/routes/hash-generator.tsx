import { useState, useEffect, useCallback, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Hash, Copy, Shield, Check, RotateCcw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDropzone } from "@/components/file-dropzone"
import { ToolPageLayout } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import {
  hashTextSelected,
  hashFileSelected,
  type HashAlgorithm,
  type HashResult,
} from "@/utils/crypto"

export const Route = createFileRoute("/hash-generator")({
  component: HashGeneratorPage,
})

interface AlgorithmMeta {
  algo: HashAlgorithm
  label: string
  color: string
  bits: number
}

const ALGORITHMS: AlgorithmMeta[] = [
  { algo: "MD5", label: "MD5", color: "text-red-400", bits: 128 },
  { algo: "SHA-1", label: "SHA-1", color: "text-yellow-400", bits: 160 },
  { algo: "SHA-256", label: "SHA-256", color: "text-emerald-400", bits: 256 },
  { algo: "SHA-384", label: "SHA-384", color: "text-violet-400", bits: 384 },
  { algo: "SHA-512", label: "SHA-512", color: "text-blue-400", bits: 512 },
]

const DEFAULT_SELECTED: HashAlgorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-512"]

const DIGEST_FORMATS = [
  { key: "hex", label: "Hex" },
  { key: "hexUpper", label: "HEX" },
  { key: "base64", label: "Base64" },
  { key: "base64url", label: "Base64URL" },
] as const

function HashGeneratorPage() {
  const [activeTab, setActiveTab] = useState<"text" | "file">("text")
  const [textInput, setTextInput] = useState("")
  const [selectedAlgos, setSelectedAlgos] = useState<HashAlgorithm[]>(DEFAULT_SELECTED)
  const [hashes, setHashes] = useState<Record<string, HashResult> | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState("")
  const { copy } = useClipboard()
  const computeIdRef = useRef(0)

  const debouncedText = useDebounce(textInput, 300)

  const toggleAlgo = useCallback((algo: HashAlgorithm) => {
    setSelectedAlgos((prev) => {
      if (prev.includes(algo)) {
        if (prev.length === 1) return prev
        return prev.filter((a) => a !== algo)
      }
      return [...prev, algo]
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedAlgos(ALGORITHMS.map((a) => a.algo))
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedAlgos(DEFAULT_SELECTED)
  }, [])

  // Compute hashes for text input with debouncing
  useEffect(() => {
    if (activeTab !== "text") return
    if (!debouncedText.trim()) {
      setHashes(null)
      return
    }
    if (selectedAlgos.length === 0) {
      setHashes(null)
      return
    }
    const id = ++computeIdRef.current
    setLoading(true)
    hashTextSelected(debouncedText, selectedAlgos).then((result) => {
      if (id === computeIdRef.current) {
        setHashes(result)
        setLoading(false)
      }
    })
  }, [debouncedText, activeTab, selectedAlgos])

  const handleFile = async (file: File) => {
    if (selectedAlgos.length === 0) return
    const id = ++computeIdRef.current
    setLoading(true)
    setFileName(file.name)
    try {
      const result = await hashFileSelected(file, selectedAlgos)
      if (id === computeIdRef.current) {
        setHashes(result)
      }
    } finally {
      if (id === computeIdRef.current) {
        setLoading(false)
      }
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as "text" | "file")
    setHashes(null)
    setFileName("")
    setLoading(false)
  }

  const copyAll = useCallback(() => {
    if (!hashes) return
    const lines = ALGORITHMS.filter((a) => a.algo in hashes)
      .map(({ algo, label }) => {
        const r = hashes[algo] as HashResult;
        return `${label}:\n  Hex:       ${r.hex}\n  Base64:    ${r.base64}\n  Base64URL: ${r.base64url}`
      })
      .join("\n\n")
    copy(lines, "All hashes copied")
  }, [hashes, copy])

  const activeAlgos = ALGORITHMS.filter((a) => selectedAlgos.includes(a.algo))

  return (
    <ToolPageLayout
      variant="scroll"
      icon={Hash}
      title="Hash Generator"
      description="Generate MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes from text or files in multiple digest encodings."
      badge="Utility"
    >
      {/* Algorithm selector */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Hash Algorithms
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={selectAll}
              >
                <Check className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={resetSelection}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALGORITHMS.map(({ algo, label, bits }) => {
              const isSelected = selectedAlgos.includes(algo)
              return (
                <Button
                  key={algo}
                  variant={isSelected ? "secondary" : "outline"}
                  size="sm"
                  className={`h-8 text-xs transition-all ${
                    isSelected
                      ? "ring-1 ring-primary/40"
                      : "opacity-60"
                  }`}
                  onClick={() => toggleAlgo(algo)}
                >
                  {label}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {bits}bit
                  </span>
                </Button>
              )
            })}
          </div>
          {selectedAlgos.length === 0 && (
            <p className="text-xs text-destructive">
              Select at least one algorithm to compute hashes.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Input */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="text" className="flex-1 sm:flex-none">
                Text Input
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1 sm:flex-none">
                File Input
              </TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <Textarea
                placeholder="Type or paste text to hash..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </TabsContent>
            <TabsContent value="file">
              <FileDropzone
                onFile={handleFile}
                label="Drop a file to compute its hash"
                sublabel="Works with any file type and size"
              />
              {fileName && (
                <p className="mt-2 text-xs text-muted-foreground">
                  File: <span className="font-mono">{fileName}</span>
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Computing hashes...
            </span>
          </CardContent>
        </Card>
      )}

      {/* Results — all digest formats per algorithm */}
      {hashes && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={copyAll}
            >
              <Copy className="h-3 w-3 mr-1.5" />
              Copy All
            </Button>
          </div>

          {activeAlgos.map(({ algo, label, color }) => {
            const result = hashes[algo]
            if (!result) return null
            return (
              <Card key={algo}>
                <CardContent className="p-4 space-y-3">
                  {/* Algorithm header */}
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 shrink-0 ${color}`} />
                    <span className="text-sm font-semibold">{label}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {ALGORITHMS.find((a) => a.algo === algo)!.bits}bit
                    </Badge>
                  </div>

                  {/* All digest formats */}
                  <div className="space-y-2">
                    {DIGEST_FORMATS.map(({ key, label: fmtLabel }) => {
                      const value = result[key]
                      return (
                        <div
                          key={key}
                          className="flex items-start gap-3 group"
                        >
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0 pt-1 text-right">
                            {fmtLabel}
                          </span>
                          <span className="flex-1 font-mono text-xs break-all select-all leading-relaxed">
                            {value}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() =>
                                  copy(value, `${algo} ${fmtLabel} copied`)
                                }
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy {fmtLabel}</TooltipContent>
                          </Tooltip>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </ToolPageLayout>
  )
}
