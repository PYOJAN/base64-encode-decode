import { useCallback, useState, type DragEvent } from "react"

interface UseFileDropOptions {
  onFile: (file: File) => void
  accept?: string
  /** Called when a dropped file fails the `accept` filter. Without it the drop is silent. */
  onReject?: (file: File) => void
  /**
   * Receives every accepted file in one call. When set it replaces `onFile`, so a drop of
   * five PDFs is handled as one batch instead of silently keeping only the first.
   */
  onFiles?: (files: File[]) => void
}

function matchesAccept(file: File, accept: string) {
  return accept
    .split(",")
    .map((s) => s.trim())
    .some(
      (a) =>
        file.type === a ||
        (a.endsWith("/*") && file.type.startsWith(a.replace("/*", "/"))) ||
        (a.startsWith(".") && file.name.toLowerCase().endsWith(a.toLowerCase()))
    )
}

export function useFileDrop({ onFile, accept, onReject, onFiles }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false)

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const dropped = Array.from(e.dataTransfer.files)
      if (dropped.length === 0) return

      const accepted = accept ? dropped.filter((f) => matchesAccept(f, accept)) : dropped
      const rejected = accept ? dropped.filter((f) => !matchesAccept(f, accept)) : []

      const [firstRejected] = rejected
      if (firstRejected) onReject?.(firstRejected)

      const [firstAccepted] = accepted
      if (!firstAccepted) return

      if (onFiles) onFiles(accepted)
      else onFile(firstAccepted)
    },
    [onFile, onFiles, accept, onReject]
  )

  return { isDragging, onDragOver, onDragLeave, onDrop }
}
