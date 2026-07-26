import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface WorkbenchLayoutProps {
  /** Page heading. Rendered as a visually hidden <h1> — the strip has no room for it, but
   *  every route still needs exactly one for SEO and screen readers. */
  title: string
  /** Left side of the strip: status dots, file name, badges. */
  status?: React.ReactNode
  /** Right side of the strip. Pushed to the far edge automatically. */
  actions?: React.ReactNode
  /** Full-width notice rendered between the strip and the body. */
  banner?: React.ReactNode
  children: React.ReactNode
}

/**
 * Full-bleed shell for viewer- and editor-heavy tools: a slim status strip over a body that
 * takes the rest of the viewport. Unlike ToolPageLayout there is no visible page header, no
 * max-width, and no padding around the body, so a PDF or canvas can run edge to edge.
 *
 * 3rem is the height of the app header in routes/__root.tsx.
 */
export function WorkbenchLayout({
  title,
  status,
  actions,
  banner,
  children,
}: WorkbenchLayoutProps) {
  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col overflow-hidden">
      <VisuallyHidden>
        <h1>{title}</h1>
      </VisuallyHidden>

      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2 sm:px-4">
        {status}
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>
        )}
      </div>

      {banner}

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
