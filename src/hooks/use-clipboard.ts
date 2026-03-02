import { useCallback, useState } from "react"
import { toast } from "sonner"

export function useClipboard() {
  const [isCopying, setIsCopying] = useState(false)
  const [isPasting, setIsPasting] = useState(false)

  const copy = useCallback(
    async (text: string, label = "Copied to clipboard") => {
      if (!text) return

      try {
        setIsCopying(true)
        await navigator.clipboard.writeText(text)
        toast.success(label)
      } catch (err) {
        console.error("Copy failed:", err)
        toast.error("Failed to copy")
      } finally {
        setIsCopying(false)
      }
    },
    []
  )

  const paste = useCallback(async () => {
    try {
      setIsPasting(true)

      if (!navigator.clipboard || !window.isSecureContext) {
        toast.error("Clipboard not supported (Use HTTPS or localhost)")
        return ""
      }

      const text = await navigator.clipboard.readText()

      if (!text) {
        toast.warning("Clipboard is empty")
      }

      return text
    } catch (err) {
      console.error("Paste failed:", err)
      toast.error("Failed to read clipboard")
      return ""
    } finally {
      setIsPasting(false)
    }
  }, [])

  return {
    copy,
    paste,
    isCopying,
    isPasting,
  }
}