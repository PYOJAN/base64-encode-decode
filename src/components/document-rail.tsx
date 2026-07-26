import { useEffect, useRef, type ReactNode } from "react"
import { FileText, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface RailItem {
  id: string
  label: string
  /** Short trailing detail such as a file size. */
  meta?: string
}

interface DocumentRailProps {
  items: RailItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onAdd?: () => void
  addLabel?: string
  /** Leading glyph on each tab. Defaults to a document icon. */
  icon?: ReactNode
}

/**
 * Tab strip for the documents a workbench page currently holds.
 *
 * Sits *inside* the WorkbenchLayout status strip rather than on a row of its own — that row
 * already carries the tool name and the actions, so a second one just eats height. The tabs
 * take the free space and scroll sideways; Add and the divider sit outside the scroll area so
 * they never drift out of view, which also keeps the tabs visually separate from the
 * right-hand actions.
 *
 * This is the only place the active document is named; the strip does not repeat it.
 */
export function DocumentRail({
  items,
  activeId,
  onSelect,
  onRemove,
  onAdd,
  addLabel = "Add",
  icon,
}: DocumentRailProps) {
  const activeRef = useRef<HTMLDivElement>(null)

  // Adding a document makes it active. Without this it can land outside the visible part of
  // the strip, so the file the user just opened appears to have gone nowhere.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeId, items.length])

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div
        // Scrolls both ways: trackpad and shift+wheel natively, plain vertical wheel via the
        // handler below. A 14px scrollbar under 28px tabs would eat most of the strip, so it
        // is hidden and these gestures replace it.
        onWheel={(e) => {
          if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain py-0.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {items.map((item) => {
          const isActive = item.id === activeId

          return (
            <div
              key={item.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(item.id)}
              className={cn(
                "group flex h-8 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border pl-2.5 pr-1.5 text-xs transition-all",
                isActive
                  ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70"
              )}
            >
              <span className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")}>
                {icon ?? <FileText className="h-3.5 w-3.5" />}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(item.id)
                }}
                aria-current={isActive}
                className={cn(
                  "max-w-[11rem] truncate outline-none",
                  isActive && "font-medium"
                )}
                title={item.meta ? `${item.label} — ${item.meta}` : item.label}
              >
                {item.label}
              </button>

              {item.meta && (
                <span className="shrink-0 rounded bg-muted-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {item.meta}
                </span>
              )}

              {/* Hidden until hover/focus so a long strip of tabs stays calm, but always
                  shown on the active one and always reachable by keyboard. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(item.id)
                }}
                aria-label={`Close ${item.label}`}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all",
                  "hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100",
                  isActive ? "opacity-70" : "opacity-0 group-hover:opacity-70"
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>

      {onAdd && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
          title={addLabel}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">{addLabel}</span>
        </Button>
      )}

      <span className="ml-1 hidden h-5 w-px shrink-0 bg-border sm:block" />
    </div>
  )
}
