import { useEffect, useRef, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { ClipboardPaste, Copy, FileUp, Link, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PdfViewer } from "@/components/pdf-viewer"
import {
  BigTextOutput,
  DocumentRail,
  PdfDropSurface,
  ResizableSplit,
  WorkbenchLayout,
} from "@/components"
import { useClipboard, useFileDrop } from "@/hooks"
import { formatFileSize } from "@/utils/file-reader"
import { encodeFileToBase64 } from "@/utils/base64-async"

export const Route = createFileRoute("/pdf-to-base64")({
  component: PdfToBase64Page,
})

const PDF_ACCEPT = ".pdf,application/pdf"

interface EncodedPdf {
  id: string
  name: string
  size: string
  /** Object URL backing the preview. The viewer takes this directly — no Base64 involved. */
  url: string
  /** Empty until the background encode finishes. */
  base64: string
  encoding: boolean
  failed: boolean
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

function PdfToBase64Page() {
  const [files, setFiles] = useState<EncodedPdf[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState("")

  const { copy, isCopying } = useClipboard()
  const addInputRef = useRef<HTMLInputElement>(null)

  const active = files.find((f) => f.id === activeId) ?? null

  // Object URLs outlive React state unless we revoke them, so the last render's list is kept
  // in a ref purely so unmount can clean up whatever is still open.
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), [])

  const addFiles = async (incoming: File[]) => {
    const pdfs = incoming.filter(isPdfFile)

    if (pdfs.length === 0) {
      setUploadError("Only PDF files can be encoded here.")
      return
    }

    setUploadError(incoming.length > pdfs.length ? "Skipped files that were not PDFs." : "")

    // Register everything up front. The preview only needs an object URL, so documents open
    // instantly and Base64 encoding — the slow part on a large PDF — happens behind them.
    const entries: EncodedPdf[] = pdfs.map((file, index) => ({
      id: `${file.name}-${file.size}-${index}-${performance.now()}`,
      name: file.name,
      size: formatFileSize(file.size),
      url: URL.createObjectURL(file),
      base64: "",
      encoding: true,
      failed: false,
    }))

    setFiles((current) => [...current, ...entries])
    // The first of the batch, not the last: it is already viewable and it is what the user
    // watched land.
    setActiveId(entries[0]!.id)

    const failed: string[] = []

    // Sequential rather than Promise.all — one worker handles the queue, and encoding five
    // large PDFs at once would only make each of them finish later.
    for (const [index, file] of pdfs.entries()) {
      const entry = entries[index]!

      try {
        const base64 = await encodeFileToBase64(file)
        setFiles((current) =>
          current.map((f) => (f.id === entry.id ? { ...f, base64, encoding: false } : f))
        )
      } catch {
        failed.push(file.name)
        setFiles((current) =>
          current.map((f) => (f.id === entry.id ? { ...f, encoding: false, failed: true } : f))
        )
      }
    }

    if (failed.length > 0) setUploadError(`Could not encode ${failed.join(", ")}.`)
  }

  const removeFile = (id: string) => {
    const index = files.findIndex((f) => f.id === id)
    if (index === -1) return

    URL.revokeObjectURL(files[index]!.url)
    const next = files.filter((f) => f.id !== id)
    setFiles(next)

    if (id === activeId) {
      setActiveId((next[index] ?? next[index - 1])?.id ?? null)
    }
  }

  const clearAll = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url))
    setFiles([])
    setActiveId(null)
    setUploadError("")
  }

  // Dropping onto the loaded view adds to the list instead of replacing it.
  const { isDragging, onDragOver, onDragLeave, onDrop } = useFileDrop({
    onFile: (file) => void addFiles([file]),
    onFiles: (dropped) => void addFiles(dropped),
    accept: PDF_ACCEPT,
    onReject: () => setUploadError("Only PDF files can be encoded here."),
  })

  const encodingCount = files.filter((f) => f.encoding).length
  const copyReady = Boolean(active && active.base64)

  return (
    <WorkbenchLayout
      title="PDF to Base64"
      status={
        <>
          <div className="flex shrink-0 items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" />
            {/* Hidden once chips are present on a narrow strip — they need the room more. */}
            <span className="hidden text-xs font-medium sm:inline">PDF to Base64</span>
          </div>

          {files.length > 0 && (
            <>
              <span className="hidden h-4 w-px shrink-0 bg-border sm:block" />
              <DocumentRail
                items={files.map((f) => ({ id: f.id, label: f.name, meta: f.size }))}
                activeId={activeId}
                onSelect={setActiveId}
                onRemove={removeFile}
                onAdd={() => addInputRef.current?.click()}
                addLabel="Add PDFs"
              />
            </>
          )}

          {encodingCount > 0 && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {encodingCount > 1 ? `Encoding ${encodingCount} PDFs` : "Encoding"}
            </span>
          )}
        </>
      }
      actions={
        files.length > 0 ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={isCopying || !copyReady}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {isCopying ? "Copying..." : "Copy"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => active && copy(active.base64, "Raw Base64 copied")}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Raw Base64
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    active &&
                    copy(`data:application/pdf;base64,${active.base64}`, "Data URI copied")
                  }
                >
                  <Link className="mr-2 h-3.5 w-3.5" />
                  Base64 Data URI
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    active && copy(encodeURIComponent(active.base64), "URL-encoded copied")
                  }
                >
                  <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
                  URL encoded
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear all
            </Button>
          </>
        ) : undefined
      }
    >
      {files.length === 0 ? (
        <PdfDropSurface
          onFile={(file) => void addFiles([file])}
          onFiles={(picked) => void addFiles(picked)}
          onReject={() => setUploadError("Only PDF files can be encoded here.")}
          title="Encode PDFs to Base64"
          subtitle="Drop one or more PDFs anywhere on this panel, or browse from your device. Files are read locally and never uploaded."
          actionLabel="Choose PDFs"
          error={uploadError}
        />
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className="relative flex h-full min-h-0 flex-col"
        >
          {uploadError && (
            <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5">
              <p className="text-xs text-destructive">{uploadError}</p>
            </div>
          )}

          <div className="min-h-0 flex-1">
            {active && (
              <ResizableSplit
                storageKey="pdf-to-base64:split"
                initial={55}
                start={
                  <PdfViewer
                    bare
                    key={active.id}
                    data={active.url}
                    title={active.name}
                    className="h-full"
                  />
                }
                end={
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Base64 output
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        {active.encoding && <Loader2 className="h-3 w-3 animate-spin" />}
                        {active.encoding
                          ? "encoding..."
                          : active.failed
                            ? "failed"
                            : `${active.base64.length.toLocaleString()} chars`}
                      </span>
                    </div>
                    <BigTextOutput
                      key={active.id}
                      value={active.base64}
                      placeholder={
                        active.failed ? "This PDF could not be encoded." : "Encoding this PDF..."
                      }
                      className="min-h-0 flex-1 gap-0"
                      textareaClassName="rounded-none border-0 bg-transparent focus-visible:ring-0"
                    />
                  </div>
                }
              />
            )}
          </div>

          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/50 px-10 py-8">
                <Plus className="h-6 w-6 text-primary" />
                <p className="text-sm font-medium">Drop to add more PDFs</p>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={addInputRef}
        type="file"
        accept={PDF_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length > 0) void addFiles(picked)
          e.target.value = ""
        }}
      />
    </WorkbenchLayout>
  )
}
