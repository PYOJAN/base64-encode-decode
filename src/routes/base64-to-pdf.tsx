import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Download, FileDown, FileText, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { base64ByteLength } from "@/utils/base64"
import { decodeBase64ToBytes } from "@/utils/base64-async"
import { formatFileSize } from "@/utils/file-reader"
import { normalizeBase64 } from "@/utils/smart-base64"

export const Route = createFileRoute("/base64-to-pdf")({
  component: Base64ToPdfPage,
})

interface Base64Doc {
  id: string
  label: string
  input: string
}

interface Preview {
  url: string
  /** The exact payload this preview was built from, so a stale one can be spotted. */
  source: string
}

function createDoc(index: number): Base64Doc {
  return { id: `doc-${index}-${performance.now()}`, label: `Document ${index}`, input: "" }
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // "%PDF"

function Base64ToPdfPage() {
  const [docs, setDocs] = useState<Base64Doc[]>(() => [createDoc(1)])
  const [activeId, setActiveId] = useState<string | null>(() => null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const { paste, isPasting } = useClipboard()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewDocRef = useRef<string | null>(null)
  const previewSourceRef = useRef<string | null>(null)
  const createdCount = useRef(1)

  const active = docs.find((d) => d.id === activeId) ?? docs[0] ?? null
  const input = active?.input ?? ""
  const activeKey = active?.id ?? null

  // Normalising walks the whole payload. On a 14 M character paste that is pure waste on every
  // unrelated re-render, so it is keyed to the input itself. A non-null result is already valid
  // Base64 by construction, so there is no second validation pass here.
  const { trimmed, normalized, valid, wasRepaired, byteSize } = useMemo(() => {
    const value = input.trim()
    const cleaned = normalizeBase64(value)
    const isValid = cleaned !== null

    return {
      trimmed: value,
      normalized: cleaned,
      valid: isValid,
      // A plain comparison rather than re-running the cleanup regexes just to diff them:
      // engines compare strings natively and bail immediately on a length mismatch.
      wasRepaired: isValid && cleaned !== value,
      byteSize: isValid ? base64ByteLength(cleaned!) : 0,
    }
  }, [input])

  const raw = normalized ?? ""

  // The rail's size chips need the same expensive pass for every open document. Deferring only
  // the chip values keeps typing responsive while the list structure stays current.
  const deferredDocs = useDeferredValue(docs)
  const metaById = useMemo(() => {
    const map = new Map<string, string>()

    for (const doc of deferredDocs) {
      const cleaned = normalizeBase64(doc.input)
      if (cleaned) map.set(doc.id, formatFileSize(base64ByteLength(cleaned)))
    }

    return map
  }, [deferredDocs])

  const railItems = docs.map((doc) => ({
    id: doc.id,
    label: doc.label,
    meta: metaById.get(doc.id),
  }))

  /**
   * The viewer is handed an object URL, not a Data URI. Passing Base64 would make it decode the
   * whole payload a second time on the main thread, on top of the decode happening here.
   */
  useEffect(() => {
    const switched = previewDocRef.current !== activeKey
    previewDocRef.current = activeKey

    if (!valid || !raw) {
      previewSourceRef.current = null
      setPreview(null)
      return
    }

    if (previewSourceRef.current === raw) return

    let cancelled = false

    // Switching documents must feel instant, but typing should settle first — every change
    // means decoding the entire payload again.
    const timer = setTimeout(() => {
      void decodeBase64ToBytes(raw)
        .then((bytes) => {
          if (cancelled) return
          previewSourceRef.current = raw
          const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }))
          setPreview({ url, source: raw })
        })
        .catch(() => {
          if (!cancelled) toast.error("That Base64 could not be decoded.")
        })
    }, switched ? 0 : 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [raw, valid, activeKey])

  // Runs when `preview` is replaced and on unmount, by which point the viewer already holds
  // the newer URL.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview.url)
  }, [preview])

  const previewReady = preview !== null
  const previewPending = valid && preview?.source !== raw

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
    const index = docs.findIndex((d) => d.id === id)
    if (index === -1) return

    const next = docs.filter((d) => d.id !== id)

    if (next.length === 0) {
      createdCount.current = 1
      const fresh = createDoc(1)
      setDocs([fresh])
      setActiveId(fresh.id)
      return
    }

    setDocs(next)
    if (id === (activeId ?? docs[0]?.id)) {
      setActiveId((next[index] ?? next[index - 1])?.id ?? null)
    }
  }

  const clearAll = () => {
    createdCount.current = 1
    const fresh = createDoc(1)
    setDocs([fresh])
    setActiveId(fresh.id)
  }

  const handleDownload = async () => {
    if (!valid || isDownloading) return

    setIsDownloading(true)
    try {
      const bytes = await decodeBase64ToBytes(raw)

      if (bytes.length < 4 || PDF_MAGIC.some((byte, i) => bytes[i] !== byte)) {
        toast.error("This Base64 does not decode to a PDF.")
        return
      }

      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }))
      const link = document.createElement("a")
      link.href = url
      link.download = `${active?.label.toLowerCase().replace(/\s+/g, "-") ?? "decoded-file"}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Invalid Base64 data.")
    } finally {
      setIsDownloading(false)
    }
  }

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
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleDownload}
            disabled={!valid || isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
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
                        {valid ? `${formatFileSize(byteSize)} · ` : ""}
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
                  spellCheck={false}
                  className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed focus-visible:ring-0"
                />
              </div>
            }
            end={
              previewReady ? (
                <div className="relative h-full min-h-0">
                  <PdfViewer
                    bare
                    data={preview.url}
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
