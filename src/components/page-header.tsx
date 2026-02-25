import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface PageHeaderProps {
  icon: LucideIcon
  title: string
  description: string
  badge: string
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  badge,
}: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wider font-medium"
            >
              {badge}
            </Badge>
          </div>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
