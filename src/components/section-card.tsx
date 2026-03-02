import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}

export function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <Separator />
        {children}
      </CardContent>
    </Card>
  )
}
