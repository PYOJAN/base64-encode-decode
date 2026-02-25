import { useCallback, useState, type DragEvent } from "react"

interface UseFileDropOptions {
  onFile: (file: File) => void
  accept?: string
}

export function useFileDrop({ onFile, accept }: UseFileDropOptions) {
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
      const file = e.dataTransfer.files[0]
      if (file) {
        if (accept) {
          const accepted = accept.split(",").map((s) => s.trim())
          const matches = accepted.some(
            (a) =>
              file.type === a ||
              (a.endsWith("/*") && file.type.startsWith(a.replace("/*", "/"))) ||
              (a.startsWith(".") && file.name.endsWith(a))
          )
          if (!matches) return
        }
        onFile(file)
      }
    },
    [onFile, accept]
  )

  return { isDragging, onDragOver, onDragLeave, onDrop }
}
