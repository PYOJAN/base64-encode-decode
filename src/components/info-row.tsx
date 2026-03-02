import { Copy, Loader } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useClipboard } from "@/hooks/use-clipboard"

interface InfoRowProps {
  label: string
  value: string
  mono?: boolean
}

export function InfoRow({ label, value, mono }: InfoRowProps) {
  const { copy, isCopying } = useClipboard()

  if (!value) return null

  return (
    <div className="flex items-start gap-3 text-xs group">
      <span className="text-muted-foreground w-36 shrink-0 pt-0.5 text-right">
        {label}
      </span>
      <span
        className={`break-all flex-1 ${mono ? "font-mono text-[11px] leading-relaxed" : ""}`}
      >
        {value}
      </span>
      {value && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => copy(value, `${label} copied`)}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              {isCopying ? (
                <Loader className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
