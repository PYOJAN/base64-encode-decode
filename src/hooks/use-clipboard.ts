import { useCallback } from "react"
import { toast } from "sonner"

export function useClipboard() {
  const copy = useCallback(async (text: string, label = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(label)
    } catch {
      toast.error("Failed to copy")
    }
  }, [])

  const paste = useCallback(async () => {
    try {
      return await navigator.clipboard.readText()
    } catch {
      toast.error("Failed to read clipboard")
      return ""
    }
  }, [])

  return { copy, paste }
}
