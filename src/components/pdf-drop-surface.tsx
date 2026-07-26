import { useRef } from "react"
import { FileCheck2, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFileDrop } from "@/hooks"
import { cn } from "@/lib/utils"

interface PdfDropSurfaceProps {
  onFile: (file: File) => void
  title: string
  subtitle: string
  accept?: string
  actionLabel?: string
  error?: string
  /** Called when a dragged file fails the accept filter, so the page can explain why. */
  onReject?: (file: File) => void
  /** Accept a batch. When set, drops and the file picker hand over every selected file. */
  onFiles?: (files: File[]) => void
  /** Reading a file — swap the prompt for a spinner and stop accepting new drops. */
  busy?: boolean
  busyLabel?: string
  /** Optional strip pinned to the bottom — used for library links and credits. */
  footer?: React.ReactNode
}

/**
 * Whole-panel drop target for the empty state of a workbench page.
 *
 * Deliberately not built on FileDropzone: that component draws its own dashed box, which reads
 * as a box-inside-a-box when the panel is already the drop area. Here the entire surface
 * accepts the drop and the dashed outline only appears while dragging.
 */
export function PdfDropSurface({
  onFile,
  title,
  subtitle,
  accept = ".pdf,application/pdf",
  actionLabel = "Choose PDF",
  error,
  onReject,
  onFiles,
  busy = false,
  busyLabel = "Reading file...",
  footer,
}: PdfDropSurfaceProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { isDragging, onDragOver, onDragLeave, onDrop } = useFileDrop({
    onFile,
    accept,
    onReject,
    onFiles,
  })

  return (
    <div
      onDragOver={busy ? undefined : onDragOver}
      onDragLeave={busy ? undefined : onDragLeave}
      onDrop={busy ? undefined : onDrop}
      className={cn(
        "relative flex h-full flex-col transition-colors",
        isDragging && !busy && "bg-primary/5"
      )}
    >
      {isDragging && !busy && (
        <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-dashed border-primary/40" />
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {busy ? (
          <>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{busyLabel}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Large documents can take a moment. Everything is processed on this device.
            </p>
          </>
        ) : (
          <>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileCheck2 className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {isDragging ? "Drop to continue" : title}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>

            <Button className="mt-6" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {actionLabel}
            </Button>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={Boolean(onFiles)}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            const [first] = picked
            if (first) {
              if (onFiles) onFiles(picked)
              else onFile(first)
            }
            e.target.value = ""
          }}
        />
      </div>

      {footer}
    </div>
  )
}
