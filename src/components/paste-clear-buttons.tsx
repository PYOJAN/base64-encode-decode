import { ClipboardPaste, Trash2, Loader } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PasteClearButtonsProps {
  onPaste: () => void
  onClear: () => void
  isPasting?: boolean
  clearDisabled?: boolean
}

export function PasteClearButtons({
  onPaste,
  onClear,
  isPasting = false,
  clearDisabled = true,
}: PasteClearButtonsProps) {
  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={onPaste}
        disabled={isPasting}
      >
        {isPasting ? (
          <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
        )}
        Paste from Clipboard
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={clearDisabled}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
