export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-512"

async function computeHash(algorithm: HashAlgorithm, data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(algorithm, data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function hashText(
  text: string
): Promise<Record<HashAlgorithm, string>> {
  const data = new TextEncoder().encode(text).buffer as ArrayBuffer
  const [sha1, sha256, sha512] = await Promise.all([
    computeHash("SHA-1", data),
    computeHash("SHA-256", data),
    computeHash("SHA-512", data),
  ])
  return { "SHA-1": sha1, "SHA-256": sha256, "SHA-512": sha512 }
}

export async function hashFile(
  file: File
): Promise<Record<HashAlgorithm, string>> {
  const data = await file.arrayBuffer()
  const [sha1, sha256, sha512] = await Promise.all([
    computeHash("SHA-1", data),
    computeHash("SHA-256", data),
    computeHash("SHA-512", data),
  ])
  return { "SHA-1": sha1, "SHA-256": sha256, "SHA-512": sha512 }
}
