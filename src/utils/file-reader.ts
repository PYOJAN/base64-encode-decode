const EQUALS = 61 // "=".charCodeAt(0)

/** First character in the payload that cannot be Base64. Padding is validated separately. */
const NON_BASE64 = /[^A-Za-z0-9+/]/

/**
 * Cheap structural validation of a Base64 string.
 *
 * The tempting one-liner is `btoa(atob(str)) === str`, but that decodes and re-encodes the whole
 * payload: on a 14 M character string it allocates ~38 MB and costs several hundred milliseconds
 * — every time it runs. Since these pages call it during render, that alone froze the UI on
 * every keystroke. A single native scan for an out-of-alphabet character does the same job.
 */
export function isBase64(str: string): boolean {
  const length = str.length
  if (length === 0 || length % 4 !== 0) return false

  // Padding is only ever the last one or two characters of the final quad.
  let payloadEnd = length
  if (str.charCodeAt(length - 1) === EQUALS) {
    payloadEnd = str.charCodeAt(length - 2) === EQUALS ? length - 2 : length - 1
  }

  const offender = NON_BASE64.exec(str)

  // A match at or past payloadEnd can only be the padding we just accounted for.
  return offender === null || offender.index >= payloadEnd
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
