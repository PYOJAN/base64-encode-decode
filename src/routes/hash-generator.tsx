import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Hash, Copy, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDropzone } from "@/components/file-dropzone"
import { PageHeader } from "@/components/page-header"
import { useClipboard } from "@/hooks/use-clipboard"
import { useDebounce } from "@/hooks/use-debounce"
import { hashText, hashFile, type HashAlgorithm } from "@/utils/crypto"

export const Route = createFileRoute("/hash-generator")({
  component: HashGeneratorPage,
})

const ALGORITHMS: { algo: HashAlgorithm; label: string; color: string }[] = [
  { algo: "SHA-1", label: "SHA-1", color: "text-yellow-400" },
  { algo: "SHA-256", label: "SHA-256", color: "text-emerald-400" },
  { algo: "SHA-512", label: "SHA-512", color: "text-blue-400" },
]

function HashGeneratorPage() {
  const [activeTab, setActiveTab] = useState<"text" | "file">("text")
  const [textInput, setTextInput] = useState("")
  const [hashes, setHashes] = useState<Record<HashAlgorithm, string> | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState("")
  const { copy } = useClipboard()

  const debouncedText = useDebounce(textInput, 500)

  useEffect(() => {
    if (activeTab !== "text") return
    if (!debouncedText.trim()) {
      setHashes(null)
      return
    }
    let cancelled = false
    hashText(debouncedText).then((result) => {
      if (!cancelled) setHashes(result)
    })
    return () => {
      cancelled = true
    }
  }, [debouncedText, activeTab])

  const handleFile = async (file: File) => {
    setLoading(true)
    setFileName(file.name)
    try {
      const result = await hashFile(file)
      setHashes(result)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as "text" | "file")
    setHashes(null)
    setFileName("")
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageHeader
        icon={Hash}
        title="Hash Generator"
        description="Generate SHA-1, SHA-256, and SHA-512 hashes from text or files using the Web Crypto API."
        badge="Utility"
      />

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

      {hashes && !loading && (
        <div className="space-y-3">
          {ALGORITHMS.map(({ algo, label, color }) => (
            <Card key={algo}>
              <CardContent className="flex items-center gap-4 p-4">
                <Shield className={`h-5 w-5 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {label}
                  </p>
                  <p className="truncate font-mono text-sm text-foreground select-all">
                    {hashes[algo]}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copy(hashes[algo], `${algo} hash copied`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
