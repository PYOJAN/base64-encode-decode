import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface ResizableSplitProps {
  /** localStorage key so each page remembers its own ratio. */
  storageKey: string
  start: React.ReactNode
  end: React.ReactNode
  /** Percentage width of the start pane, 0-100. */
  initial?: number
  min?: number
  max?: number
  /** Viewport width at or above which the panes sit side by side. */
  sideBySideFrom?: number
}

const KEYBOARD_STEP = 2

function readStored(key: string, fallback: number) {
  const raw = window.localStorage.getItem(key)
  const parsed = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Two panes with a draggable divider: side by side on wide viewports, stacked below the
 * breakpoint. Direction is driven by matchMedia rather than Tailwind breakpoint classes so
 * `sideBySideFrom` stays truthful — CSS and JS can't disagree about which mode is active.
 *
 * The divider is a real `separator`: focusable, arrow keys nudge it, double-click resets.
 * While dragging, a full-viewport overlay swallows pointer events so the PDF canvas and
 * textareas underneath cannot steal the pointer mid-drag.
 */
export function ResizableSplit({
  storageKey,
  start,
  end,
  initial = 50,
  min = 20,
  max = 80,
  sideBySideFrom = 1024,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(() => readStored(storageKey, initial))
  const [dragging, setDragging] = useState(false)
  const [horizontal, setHorizontal] = useState(
    () => window.matchMedia(`(min-width: ${sideBySideFrom}px)`).matches
  )

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${sideBySideFrom}px)`)
    const sync = () => setHorizontal(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [sideBySideFrom])

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next))
      setPct(clamped)
      window.localStorage.setItem(storageKey, String(Math.round(clamped)))
    },
    [max, min, storageKey]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width === 0) return
      commit(((event.clientX - bounds.left) / bounds.width) * 100)
    },
    [commit, dragging]
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") commit(pct - KEYBOARD_STEP)
    else if (event.key === "ArrowRight") commit(pct + KEYBOARD_STEP)
    else if (event.key === "Home") commit(min)
    else if (event.key === "End") commit(max)
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0", horizontal ? "flex-row" : "flex-col")}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
    >
      <div
        className="min-h-0 min-w-0"
        style={horizontal ? { width: `${pct}%` } : { flex: "1 1 0%" }}
      >
        {start}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label="Resize panels"
        tabIndex={horizontal ? 0 : -1}
        onKeyDown={onKeyDown}
        onDoubleClick={() => commit(initial)}
        onPointerDown={(event) => {
          if (!horizontal) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
        }}
        className={cn(
          "group relative shrink-0 focus-visible:outline-none",
          horizontal ? "w-px cursor-col-resize" : "h-px",
          dragging ? "bg-primary" : "bg-border"
        )}
      >
        {horizontal && (
          <>
            {/* Widened grab area; the visible divider stays 1px. */}
            <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
            <span
              className={cn(
                "pointer-events-none absolute inset-y-0 -left-px -right-px transition-colors",
                "group-hover:bg-primary/60 group-focus-visible:bg-primary",
                dragging && "bg-primary"
              )}
            />
          </>
        )}
      </div>

      <div className="min-h-0 min-w-0" style={{ flex: "1 1 0%" }}>
        {end}
      </div>

      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  )
}
