const PEM_RE =
  /-----BEGIN ([A-Z0-9 ]+)-----\r?\n([\s\S]+?)\r?\n-----END \1-----/

export function pemToBytes(
  pem: string
): { type: string; bytes: Uint8Array } | null {
  const m = pem.match(PEM_RE)
  if (!m || !m[1] || !m[2]) return null
  const b64 = m[2].replace(/\s/g, "")
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { type: m[1], bytes }
}

export function bytesToPem(bytes: Uint8Array, type: string): string {
  const b64 = btoa(String.fromCharCode(...bytes))
  const lines = b64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[\s:]/g, "")
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2)
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16)
  return bytes
}

export function bytesToHex(bytes: Uint8Array, sep = ":"): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(sep)
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

/** Auto-detect and convert text input to raw DER bytes */
export function inputToBytes(input: string): Uint8Array | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // PEM
  const pem = pemToBytes(trimmed)
  if (pem) return pem.bytes

  // Raw Base64 (no PEM headers)
  try {
    const cleaned = trimmed.replace(/\s/g, "")
    if (/^[A-Za-z0-9+/]+=*$/.test(cleaned) && cleaned.length > 10) {
      const bin = atob(cleaned)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      if (bytes[0] === 0x30) return bytes // Starts with ASN.1 SEQUENCE
    }
  } catch {
    /* not base64 */
  }

  // Hex
  try {
    const hex = trimmed.replace(/[\s:]/g, "")
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0 && hex.length > 10) {
      const bytes = hexToBytes(hex)
      if (bytes[0] === 0x30) return bytes
    }
  } catch {
    /* not hex */
  }

  return null
}

export function detectPemType(input: string): string | null {
  const m = input.match(/-----BEGIN ([A-Z0-9 ]+)-----/)
  return m?.[1] ?? null
}

/** Compute SHA-256 or SHA-1 fingerprint of raw DER bytes */
export async function fingerprint(
  bytes: Uint8Array,
  algo: "SHA-256" | "SHA-1"
): Promise<string> {
  const hash = await crypto.subtle.digest(algo, bytes as ArrayBufferView<ArrayBuffer>)
  return bytesToHex(new Uint8Array(hash))
}
