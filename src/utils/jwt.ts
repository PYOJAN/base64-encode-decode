export function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (b64.length % 4) b64 += "="
  return atob(b64)
}

export interface JwtParts {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signatureHex: string
}

export function decodeJwt(token: string): JwtParts {
  const parts = token.trim().split(".")
  if (parts.length !== 3) throw new Error("Invalid JWT: expected 3 parts separated by dots")

  const headerJson = base64UrlDecode(parts[0]!)
  const payloadJson = base64UrlDecode(parts[1]!)
  const header = JSON.parse(headerJson)
  const payload = JSON.parse(payloadJson)

  // Decode signature to hex
  const sigBin = base64UrlDecode(parts[2]!)
  const signatureHex = Array.from(sigBin, (c) =>
    c.charCodeAt(0).toString(16).padStart(2, "0")
  ).join(":")

  return { header, payload, signatureHex }
}

export function getExpiryStatus(payload: Record<string, unknown>): {
  status: "valid" | "expired" | "no-expiry"
  expiresAt?: Date
  issuedAt?: Date
} {
  const now = Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === "number" ? payload.exp : undefined
  const iat = typeof payload.iat === "number" ? payload.iat : undefined

  if (exp === undefined) {
    return { status: "no-expiry", issuedAt: iat ? new Date(iat * 1000) : undefined }
  }

  return {
    status: now < exp ? "valid" : "expired",
    expiresAt: new Date(exp * 1000),
    issuedAt: iat ? new Date(iat * 1000) : undefined,
  }
}
