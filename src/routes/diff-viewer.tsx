import { useState, useEffect, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { GitCompareArrows, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { ToolPageLayout } from "@/components"
import { useClipboard, useDebounce } from "@/hooks"
import diff from "fast-diff"

export const Route = createFileRoute("/diff-viewer")({
  component: DiffViewerPage,
})

type DiffTuple = [number, string]

function DiffViewerPage() {
  const [original, setOriginal] = useState("")
  const [modified, setModified] = useState("")
  const [result, setResult] = useState<DiffTuple[]>([])
  const { copy } = useClipboard()

  const debouncedOriginal = useDebounce(original, 400)
  const debouncedModified = useDebounce(modified, 400)

  useEffect(() => {
    if (!debouncedOriginal && !debouncedModified) {
      setResult([])
      return
    }
    const d = diff(debouncedOriginal, debouncedModified)
    setResult(d)
  }, [debouncedOriginal, debouncedModified])

  const stats = useMemo(() => {
    let insertions = 0
    let deletions = 0
    let unchanged = 0
    for (const [type, text] of result) {
      if (type === 1) insertions += text.length
      else if (type === -1) deletions += text.length
      else unchanged += text.length
    }
    return { insertions, deletions, unchanged }
  }, [result])

  const handleClear = () => {
    setOriginal("")
    setModified("")
    setResult([])
  }

  const plainDiffText = useMemo(() => {
    return result.map(([, text]) => text).join("")
  }, [result])

  return (
    <ToolPageLayout
      variant="full-height"
      icon={GitCompareArrows}
      title="Diff Viewer"
      description="Compare two texts and visualize inline differences."
      badge="Text / Data"
    >

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!original && !modified}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {result.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(plainDiffText)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {result.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-3 py-2 shrink-0 text-xs font-mono">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-emerald-400">{stats.insertions} insertions</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-red-400">{stats.deletions} deletions</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
            <span className="text-muted-foreground">{stats.unchanged} unchanged</span>
          </span>
        </div>
      )}

      {/* Input areas side by side */}
      <div className="grid gap-3 lg:grid-cols-2 shrink-0">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Original
          </label>
          <Textarea
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="Paste original text here..."
            rows={8}
            className="resize-none font-mono text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Modified
          </label>
          <Textarea
            value={modified}
            onChange={(e) => setModified(e.target.value)}
            placeholder="Paste modified text here..."
            rows={8}
            className="resize-none font-mono text-sm"
          />
        </div>
      </div>

      {/* Diff output */}
      {result.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Diff Output
          </label>
          <div className="flex-1 min-h-[120px] overflow-auto rounded-lg border bg-muted/20 p-3">
            <pre className="font-mono text-sm whitespace-pre-wrap break-all leading-relaxed">
              <code>
                {result.map(([type, text], i) => {
                  if (type === -1) {
                    return (
                      <span
                        key={i}
                        className="bg-red-500/20 text-red-300 rounded-sm px-[1px]"
                      >
                        {text}
                      </span>
                    )
                  }
                  if (type === 1) {
                    return (
                      <span
                        key={i}
                        className="bg-emerald-500/20 text-emerald-300 rounded-sm px-[1px]"
                      >
                        {text}
                      </span>
                    )
                  }
                  return <span key={i}>{text}</span>
                })}
              </code>
            </pre>
          </div>
        </div>
      )}
    </ToolPageLayout>
  )
}
