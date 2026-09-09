import { useRef } from "react"
import { Upload, File, Loader2 } from "lucide-react"
import { useFileDrop } from "@/hooks/use-file-drop"
import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  onFile: (file: File) => void
  accept?: string
  label?: string
  sublabel?: string
  className?: string
  /** Reading a file — show a spinner and stop accepting drops until it lands. */
  busy?: boolean
  busyLabel?: string
}

export function FileDropzone({
  onFile,
  accept,
  label = "Drop a file here, or click to browse",
  sublabel = "Supports any file type",
  className,
  busy = false,
  busyLabel = "Reading file...",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { isDragging, onDragOver, onDragLeave, onDrop } = useFileDrop({
    onFile,
    accept,
  })

  return (
    <div
      onClick={busy ? undefined : () => inputRef.current?.click()}
      onDragOver={busy ? undefined : onDragOver}
      onDragLeave={busy ? undefined : onDragLeave}
      onDrop={busy ? undefined : onDrop}
      className={cn(
        "group relative flex flex-1 min-h-60 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200",
        busy
          ? "cursor-default border-border bg-muted/20"
          : "cursor-pointer",
        !busy && isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : !busy && "border-border hover:border-primary/40 hover:bg-muted/30",
        className
      )}
    >
      <div
        className={cn(
          "mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200",
          busy
            ? "bg-primary/10 text-primary"
            : isDragging
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isDragging ? (
          <File className="h-5 w-5" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
      </div>
      <p className="text-sm font-medium text-foreground">
        {busy ? busyLabel : isDragging ? "Drop to upload" : label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {busy ? "Large files are processed in the background." : sublabel}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
