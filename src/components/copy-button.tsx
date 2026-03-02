import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useClipboard } from "@/hooks/use-clipboard"

interface CopyButtonProps {
  /** The text to copy */
  value: string
  /** Toast label shown after copying */
  label?: string
  /** Whether to show the button (defaults to true) */
  show?: boolean
}

export function CopyButton({
  value,
  label = "Copied!",
  show = true,
}: CopyButtonProps) {
  const { copy } = useClipboard()

  if (!show || !value) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copy(value, label)}
        >
          <Copy className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy</TooltipContent>
    </Tooltip>
  )
}
