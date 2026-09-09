/**
 * Base64 primitives, written to survive multi-megabyte payloads.
 *
 * A 10 MB file becomes a ~14 million character string, so anything that builds a string one
 * character at a time, or rewrites the whole string several times over, turns a "load a file"
 * click into a frozen tab. Every function here works in fixed-size chunks and allocates the
 * result once.
 */

const EQUALS = 61 // "=".charCodeAt(0)

/** Multiple of 3, so each chunk encodes to a self-contained Base64 block with no interior padding. */
const BYTE_CHUNK = 32_760

/** Multiple of 4, so each chunk decodes independently and padding only lands in the final one. */
const CHAR_CHUNK = 65_536

/**
 * Bytes to Base64 without ever materialising the whole binary string.
 *
 * The obvious `bytes.reduce((acc, b) => acc + String.fromCharCode(b), "")` is the single worst
 * thing you can do here: 10 MB means 10.4 million string concatenations.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""

  const blocks: string[] = []

  for (let offset = 0; offset < bytes.length; offset += BYTE_CHUNK) {
    const chunk = bytes.subarray(offset, offset + BYTE_CHUNK)
    // apply() on a 32 KB view stays far below the engine's argument-count limit.
    blocks.push(btoa(String.fromCharCode.apply(null, chunk as unknown as number[])))
  }

  return blocks.length === 1 ? blocks[0]! : blocks.join("")
}

/**
 * TypeScript 5.7 made the typed arrays generic over their backing buffer. `Blob`, `fetch` and
 * friends only accept the non-shared variant, so pin it once here instead of casting at every
 * call site.
 */
export type Bytes = Uint8Array<ArrayBuffer>

/** Base64 to bytes, decoded in place so the 10 MB intermediate binary string never exists. */
export function base64ToBytes(b64: string): Bytes {
  const bytes = new Uint8Array(base64ByteLength(b64))
  let written = 0

  for (let offset = 0; offset < b64.length; offset += CHAR_CHUNK) {
    const binary = atob(b64.slice(offset, offset + CHAR_CHUNK))
    for (let i = 0; i < binary.length; i += 1) {
      bytes[written + i] = binary.charCodeAt(i)
    }
    written += binary.length
  }

  return bytes
}

/** Decoded byte count, derived from length and padding — no decoding required. */
export function base64ByteLength(b64: string): number {
  const length = b64.length
  if (length === 0) return 0

  let padding = 0
  if (b64.charCodeAt(length - 1) === EQUALS) {
    padding = b64.charCodeAt(length - 2) === EQUALS ? 2 : 1
  }

  return Math.floor((length / 4) * 3) - padding
}

export function textToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}

export function base64ToText(b64: string): string {
  return new TextDecoder().decode(base64ToBytes(b64))
}

export function base64ToBlob(b64: string, mimeType = "application/octet-stream"): Blob {
  return new Blob([base64ToBytes(b64)], { type: mimeType })
}

/**
 * Split a Data URI into its payload and MIME type.
 *
 * Deliberately index-based rather than `/^data:([^;]+);base64,(.+)$/` — that trailing `.+`
 * captures the entire payload, which means a second 14 MB allocation on every call.
 */
export function extractBase64Data(input: string): { data: string; mimeType: string | null } {
  if (!input.startsWith("data:")) {
    return { data: trimIfNeeded(input), mimeType: null }
  }

  const comma = input.indexOf(",")
  if (comma === -1) return { data: "", mimeType: null }

  const header = input.slice(5, comma)
  if (!header.endsWith(";base64")) {
    return { data: "", mimeType: null }
  }

  return {
    data: input.slice(comma + 1),
    mimeType: header.slice(0, -";base64".length) || null,
  }
}

/** `trim()` on a multi-megabyte string copies it; skip that when there is nothing to trim. */
function trimIfNeeded(value: string): string {
  if (value.length === 0) return value

  const first = value.charCodeAt(0)
  const last = value.charCodeAt(value.length - 1)
  const isPadding = (code: number) => code === 32 || code === 9 || code === 10 || code === 13

  return isPadding(first) || isPadding(last) ? value.trim() : value
}
