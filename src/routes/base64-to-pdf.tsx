import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Download, FileDown, FileText, Loader2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PdfViewer } from "@/components/pdf-viewer"
import {
  DocumentRail,
  PasteClearButtons,
  ResizableSplit,
  ValidationDot,
  WorkbenchLayout,
} from "@/components"
import { useClipboard } from "@/hooks"
import { base64ToBlob } from "@/utils/base64"
import { isBase64 } from "@/utils/file-reader"
import { normalizeBase64 } from "@/utils/smart-base64"

export const Route = createFileRoute("/base64-to-pdf")({
  component: Base64ToPdfPage,
})

interface Base64Doc {
  id: string
  label: string
  input: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getBase64ByteSize(base64: string) {
  const padding = base64.match(/=+$/)?.[0].length ?? 0
  return (base64.length * 3) / 4 - padding
}

function createDoc(index: number): Base64Doc {
  return { id: `doc-${index}-${performance.now()}`, label: `Document ${index}`, input: "" }
}

function Base64ToPdfPage() {
  const [docs, setDocs] = useState<Base64Doc[]>(() => [createDoc(1)])
  const [activeId, setActiveId] = useState<string | null>(() => null)
  const [previewSrc, setPreviewSrc] = useState("")

  const { paste, isPasting } = useClipboard()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewDocRef = useRef<string | null>(null)
  const createdCount = useRef(1)

  const active = docs.find((d) => d.id === activeId) ?? docs[0] ?? null
  const input = active?.input ?? ""

  const trimmed = input.trim()
  const normalized = normalizeBase64(input)
  const wasRepaired = Boolean(normalized) && trimmed.replace(/\s+/g, "") !== normalized
  const valid = Boolean(normalized) && isBase64(normalized ?? "")
  const raw = normalized ?? ""
  const byteSize = getBase64ByteSize(raw)

  // Switching documents must feel instant, but typing should settle before the viewer
  // remounts — each remount re-runs a full PDF parse.
  useEffect(() => {
    const switched = previewDocRef.current !== active?.id
    previewDocRef.current = active?.id ?? null

    if (switched) {
      setPreviewSrc(raw)
      return
    }

    const timer = setTimeout(() => setPreviewSrc(raw), 400)
    return () => clearTimeout(timer)
  }, [raw, active?.id])

  const previewReady = Boolean(previewSrc) && isBase64(previewSrc)
  const previewPending = valid && previewSrc !== raw
  const pdfDataUri = `data:application/pdf;base64,${previewSrc}`

  const updateActive = (value: string) => {
    if (!active) return
    setDocs((current) =>
      current.map((d) => (d.id === active.id ? { ...d, input: value } : d))
    )
  }

  const handlePaste = async () => {
    const text = await paste()
    if (text) updateActive(text)
  }

  const addDoc = () => {
    createdCount.current += 1
    const doc = createDoc(createdCount.current)
    setDocs((current) => [...current, doc])
    setActiveId(doc.id)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const removeDoc = (id: string) => {
    setDocs((current) => {
      const index = current.findIndex((d) => d.id === id)
      const next = current.filter((d) => d.id !== id)

      if (next.length === 0) {
        createdCount.current = 1
        const fresh = createDoc(1)
        setActiveId(fresh.id)
        return [fresh]
      }

      if (id === (activeId ?? current[0]?.id)) {
        const neighbour = next[index] ?? next[index - 1] ?? null
        setActiveId(neighbour?.id ?? null)
      }

      return next
    })
  }

  const clearAll = () => {
    createdCount.current = 1
    const fresh = createDoc(1)
    setDocs([fresh])
    setActiveId(fresh.id)
  }

  const handleDownload = () => {
    if (!valid) return
    try {
      const blob = base64ToBlob(raw, "application/pdf")
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        if (!text.startsWith("%PDF")) {
          alert("This Base64 does not appear to be a valid PDF.")
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${active?.label.toLowerCase().replace(/\s+/g, "-") ?? "decoded-file"}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
      reader.readAsText(blob.slice(0, 5))
    } catch {
      alert("Invalid Base64 data.")
    }
  }

  const railItems = docs.map((doc) => {
    const docNormalized = normalizeBase64(doc.input)
    const docValid = Boolean(docNormalized) && isBase64(docNormalized ?? "")

    return {
      id: doc.id,
      label: doc.label,
      meta: docValid ? formatBytes(getBase64ByteSize(docNormalized ?? "")) : undefined,
    }
  })

  return (
    <WorkbenchLayout
      title="Base64 to PDF"
      status={
        <>
          <div className="flex shrink-0 items-center gap-2">
            <FileDown className="h-4 w-4 text-primary" />
            {/* Hidden once chips are present on a narrow strip — they need the room more. */}
            <span className="hidden text-xs font-medium sm:inline">Base64 to PDF</span>
          </div>

          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" />

          <DocumentRail
            items={railItems}
            activeId={active?.id ?? null}
            onSelect={setActiveId}
            onRemove={removeDoc}
            onAdd={addDoc}
          />

          {/* Only the decode status of the document on screen belongs here — its label and
              size are already in the rail. */}
          {trimmed && (
            <>
              <ValidationDot
                show
                valid={valid}
                validLabel="Valid"
                invalidLabel="Invalid"
              />
              {valid && wasRepaired && (
                <Badge variant="outline" className="hidden shrink-0 text-[10px] lg:inline-flex">
                  Auto-corrected
                </Badge>
              )}
            </>
          )}
        </>
      }
      actions={
        <>
          <Button size="sm" className="h-8 text-xs" onClick={handleDownload} disabled={!valid}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </Button>
          {docs.length > 1 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ResizableSplit
            storageKey="base64-to-pdf:split"
            initial={42}
            start={
              <div className="flex h-full min-h-0 flex-col">
                {/* Paste and Clear act on this textarea, so they live with it rather than in
                    the toolbar, where a second "Clear" would read as "clear all documents". */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Base64 input
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    {trimmed && (
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {valid ? `${formatBytes(byteSize)} · ` : ""}
                        {trimmed.length.toLocaleString()} chars
                      </span>
                    )}
                    <PasteClearButtons
                      onPaste={handlePaste}
                      onClear={() => updateActive("")}
                      isPasting={isPasting}
                      clearDisabled={!input}
                    />
                  </div>
                </div>
                <Textarea
                  ref={textareaRef}
                  placeholder="Paste PDF Base64 string or Data URI here..."
                  value={input}
                  onChange={(e) => updateActive(e.target.value)}
                  className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed focus-visible:ring-0"
                />
              </div>
            }
            end={
              previewReady ? (
                <div className="relative h-full min-h-0">
                  <PdfViewer
                    bare
                    data={pdfDataUri}
                    title={active?.label ?? "Decoded PDF Preview"}
                    className="h-full"
                  />
                  {previewPending && (
                    <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border bg-background/90 px-2.5 py-1 shadow-sm backdrop-blur">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Updating preview</span>
                    </div>
                  )}
                </div>
              ) : previewPending ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Decoding</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rendering the PDF preview...
                  </p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium">
                    {trimmed ? "That string isn't valid Base64" : "Preview appears here"}
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {trimmed
                      ? "Check for missing characters or truncation — common padding issues are repaired automatically."
                      : "Paste a Base64 string on the left. Use Add to decode several documents side by side."}
                  </p>
                </div>
              )
            }
          />
        </div>
      </div>
    </WorkbenchLayout>
  )
}
