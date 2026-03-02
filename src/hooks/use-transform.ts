import { useState, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"

interface UseTransformOptions {
  /** Raw input string */
  input: string
  /** Debounce delay in ms (default 400) */
  delay?: number
  /**
   * Transform function: receives debounced+trimmed input.
   * Return the output string on success, or throw to signal an error.
   */
  transform: (input: string) => string
  /**
   * Extra deps that should re-trigger the transform
   * (e.g. indent setting, format mode).
   */
  deps?: unknown[]
}

export function useTransform({
  input,
  delay = 400,
  transform,
  deps = [],
}: UseTransformOptions) {
  const [output, setOutput] = useState("")
  const [error, setError] = useState("")
  const debouncedInput = useDebounce(input, delay)

  useEffect(() => {
    const trimmed = debouncedInput.trim()
    if (!trimmed) {
      setOutput("")
      setError("")
      return
    }
    try {
      const result = transform(trimmed)
      setOutput(result)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOutput("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput, ...deps])

  return { output, error, setOutput, setError, debouncedInput }
}
