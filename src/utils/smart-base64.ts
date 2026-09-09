/** Anything outside this set has to be stripped before the payload can be decoded. */
const NEEDS_CLEANUP = /[^A-Za-z0-9+/=_-]/

const STRIP_JUNK = /[^A-Za-z0-9+/=_-]/g

const EQUALS = 61 // "=".charCodeAt(0)

/**
 * Repair a pasted Base64 payload: strip a Data URI header, drop line wrapping and stray
 * characters, fold Base64URL into standard Base64, and re-derive the padding.
 *
 * Each step is guarded by a cheap `indexOf`/`test` probe first. On a 14 M character string an
 * unconditional `.replace()` allocates a fresh copy of the whole payload, and the original ran
 * four of them back to back plus a `decodeURIComponent` — for input that was usually already
 * clean. Now the common case costs a handful of native scans and no allocation at all.
 *
 * A non-null result is guaranteed to satisfy `isBase64`, so callers do not need to re-check it.
 */
export function normalizeBase64(input: string): string | null {
  if (!input) return null

  let value = input.trim()

  // Percent-decoding is expensive and almost never needed, so only pay for it when a
  // percent sign is actually present.
  if (value.indexOf("%") !== -1) {
    try {
      value = decodeURIComponent(value)
    } catch {
      // Not percent-encoded after all — keep what we had.
    }
  }

  if (value.startsWith("data:")) {
    const comma = value.indexOf(",")
    value = comma === -1 ? "" : value.slice(comma + 1)
  }

  if (NEEDS_CLEANUP.test(value)) {
    value = value.replace(STRIP_JUNK, "")
  }

  if (value.indexOf("-") !== -1 || value.indexOf("_") !== -1) {
    value = value.replace(/-/g, "+").replace(/_/g, "/")
  }

  // Trust the payload, not the padding that came with it: drop every trailing "=" and recompute.
  let end = value.length
  while (end > 0 && value.charCodeAt(end - 1) === EQUALS) end -= 1
  if (end !== value.length) value = value.slice(0, end)

  if (value.length === 0) return null

  // Padding left anywhere but the end means the payload itself is corrupt — two strings were
  // concatenated, or a chunk went missing. Repairing that would silently produce wrong bytes.
  if (value.indexOf("=") !== -1) return null

  const remainder = value.length % 4
  if (remainder === 1) return null // no amount of padding makes this a valid length
  if (remainder === 2) value += "=="
  else if (remainder === 3) value += "="

  return value
}
