interface ToolbarProps {
  children: React.ReactNode
}

export function Toolbar({ children }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
      {children}
    </div>
  )
}

interface ToolbarTrailingProps {
  children: React.ReactNode
}

export function ToolbarTrailing({ children }: ToolbarTrailingProps) {
  return (
    <div className="ml-auto flex items-center gap-2">
      {children}
    </div>
  )
}
