import { useMemo } from "react"
import { Info } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface BigTextOutputProps {
  value: string
  placeholder?: string
  /** Wrapper classes — put layout (flex-1, h-64, ...) here. */
  className?: string
  /** Classes for the textarea itself. */
  textareaClassName?: string
  /**
   * Characters handed to the DOM before the preview is cut short.
   *
   * A textarea has to lay out and measure every character it holds, and no amount of
   * optimisation on our side changes that — a 14 million character value freezes the tab
   * regardless of how fast it was produced. Nobody scrolls a Base64 blob by hand anyway; they
   * copy or download it, and both act on the full value.
   */
  previewLimit?: number
}

const DEFAULT_PREVIEW_LIMIT = 64_000

export function BigTextOutput({
  value,
  placeholder,
  className,
  textareaClassName,
  previewLimit = DEFAULT_PREVIEW_LIMIT,
}: BigTextOutputProps) {
  const truncated = value.length > previewLimit
  const preview = useMemo(
    () => (truncated ? value.slice(0, previewLimit) : value),
    [value, truncated, previewLimit]
  )

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <Textarea
        readOnly
        value={preview}
        placeholder={placeholder}
        spellCheck={false}
        className={cn("min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed", textareaClassName)}
      />

      {truncated && (
        <div className="flex shrink-0 items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Preview shows the first{" "}
            <span className="font-mono text-foreground">{previewLimit.toLocaleString()}</span> of{" "}
            <span className="font-mono text-foreground">{value.length.toLocaleString()}</span>{" "}
            characters. Copy and download always use the complete value.
          </p>
        </div>
      )}
    </div>
  )
}
