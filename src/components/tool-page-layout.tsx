import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"

interface ToolPageLayoutProps {
  /** "full-height" for editor-based tools, "scroll" for card-based tools */
  variant?: "full-height" | "scroll"
  icon: LucideIcon
  title: string
  description: string
  badge: string
  /** Max width for scroll variant (default "max-w-4xl") */
  maxWidth?: string
  children: React.ReactNode
}

export function ToolPageLayout({
  variant = "full-height",
  icon,
  title,
  description,
  badge,
  maxWidth = "max-w-4xl",
  children,
}: ToolPageLayoutProps) {
  if (variant === "full-height") {
    return (
      <div className="flex flex-col h-[calc(100vh-3rem)] p-3 sm:p-4 gap-3">
        <PageHeader icon={icon} title={title} description={description} badge={badge} />
        {children}
      </div>
    )
  }

  return (
    <div className={`mx-auto ${maxWidth} space-y-4 sm:space-y-6 p-4 sm:p-6`}>
      <PageHeader icon={icon} title={title} description={description} badge={badge} />
      {children}
    </div>
  )
}
