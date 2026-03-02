interface ValidationDotProps {
  /** Whether to render the indicator */
  show: boolean
  /** Whether the input is valid */
  valid: boolean
  /** Label when valid */
  validLabel?: string
  /** Label when invalid */
  invalidLabel?: string
}

export function ValidationDot({
  show,
  valid,
  validLabel = "Valid",
  invalidLabel = "Invalid",
}: ValidationDotProps) {
  if (!show) return null

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div
        className={`h-2 w-2 rounded-full ${valid ? "bg-emerald-500" : "bg-destructive"}`}
      />
      <span className="text-xs text-muted-foreground">
        {valid ? validLabel : invalidLabel}
      </span>
    </div>
  )
}
