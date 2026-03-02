import forge from "node-forge"

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"

export type HashFormat = "hex" | "hex-upper" | "base64" | "base64url"

export interface HashResult {
  raw: ArrayBuffer
  hex: string
  hexUpper: string
  base64: string
  base64url: string
}

function bytesToFormats(bytes: Uint8Array): Omit<HashResult, "raw"> {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  const hexUpper = hex.toUpperCase()
  const binary = String.fromCharCode(...bytes)
  const base64 = btoa(binary)
  const base64url = base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  return { hex, hexUpper, base64, base64url }
}

function computeMd5(data: ArrayBuffer): HashResult {
  const md = forge.md.md5.create()
  md.update(forge.util.binary.raw.encode(new Uint8Array(data)))
  const digestHex = md.digest().toHex()
  const bytes = new Uint8Array(
    digestHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))
  )
  return { raw: bytes.buffer as ArrayBuffer, ...bytesToFormats(bytes) }
}

async function computeHashMulti(
  algorithm: HashAlgorithm,
  data: ArrayBuffer
): Promise<HashResult> {
  if (algorithm === "MD5") {
    return computeMd5(data)
  }
  const raw = await crypto.subtle.digest(algorithm, data)
  const bytes = new Uint8Array(raw)
  return { raw, ...bytesToFormats(bytes) }
}

async function computeHash(
  algorithm: HashAlgorithm,
  data: ArrayBuffer
): Promise<string> {
  const result = await computeHashMulti(algorithm, data)
  return result.hex
}

// Legacy single-format functions (backward compat)
export async function hashText(
  text: string
): Promise<Record<HashAlgorithm, string>> {
  const data = new TextEncoder().encode(text).buffer as ArrayBuffer
  const [md5, sha1, sha256, sha384, sha512] = await Promise.all([
    computeHash("MD5", data),
    computeHash("SHA-1", data),
    computeHash("SHA-256", data),
    computeHash("SHA-384", data),
    computeHash("SHA-512", data),
  ])
  return { "MD5": md5, "SHA-1": sha1, "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 }
}

export async function hashFile(
  file: File
): Promise<Record<HashAlgorithm, string>> {
  const data = await file.arrayBuffer()
  const [md5, sha1, sha256, sha384, sha512] = await Promise.all([
    computeHash("MD5", data),
    computeHash("SHA-1", data),
    computeHash("SHA-256", data),
    computeHash("SHA-384", data),
    computeHash("SHA-512", data),
  ])
  return { "MD5": md5, "SHA-1": sha1, "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 }
}

/** Compute selected algorithms only */
export async function hashTextSelected(
  text: string,
  algorithms: HashAlgorithm[]
): Promise<Record<string, HashResult>> {
  const data = new TextEncoder().encode(text).buffer as ArrayBuffer
  const results = await Promise.all(
    algorithms.map((algo) => computeHashMulti(algo, data))
  )
  const record: Record<string, HashResult> = {}
  algorithms.forEach((algo, i) => {
    record[algo] = results[i] as HashResult;
  })
  return record
}

/** Compute selected algorithms for a file */
export async function hashFileSelected(
  file: File,
  algorithms: HashAlgorithm[]
): Promise<Record<string, HashResult>> {
  const data = await file.arrayBuffer()
  const results = await Promise.all(
    algorithms.map((algo) => computeHashMulti(algo, data))
  )
  const record: Record<string, HashResult> = {}
  algorithms.forEach((algo, i) => {

    record[algo] = results[i] as HashResult;
  })
  return record
}

// Multi-format functions (all algorithms)
export async function hashTextMulti(
  text: string
): Promise<Record<HashAlgorithm, HashResult>> {
  const data = new TextEncoder().encode(text).buffer as ArrayBuffer
  const [md5, sha1, sha256, sha384, sha512] = await Promise.all([
    computeHashMulti("MD5", data),
    computeHashMulti("SHA-1", data),
    computeHashMulti("SHA-256", data),
    computeHashMulti("SHA-384", data),
    computeHashMulti("SHA-512", data),
  ])
  return { "MD5": md5, "SHA-1": sha1, "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 }
}

export async function hashFileMulti(
  file: File
): Promise<Record<HashAlgorithm, HashResult>> {
  const data = await file.arrayBuffer()
  const [md5, sha1, sha256, sha384, sha512] = await Promise.all([
    computeHashMulti("MD5", data),
    computeHashMulti("SHA-1", data),
    computeHashMulti("SHA-256", data),
    computeHashMulti("SHA-384", data),
    computeHashMulti("SHA-512", data),
  ])
  return { "MD5": md5, "SHA-1": sha1, "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 }
}
