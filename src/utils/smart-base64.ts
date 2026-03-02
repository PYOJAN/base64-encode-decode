export function normalizeBase64(input: string): string | null {
    if (!input) return null

    let cleaned = input.trim()

    // Decode percent-encoding (VERY IMPORTANT)
    try {
        cleaned = decodeURIComponent(cleaned)
    } catch {
        // ignore if not encoded
    }

    // Remove data URI prefix
    if (cleaned.startsWith("data:")) {
        const parts = cleaned.split(",")
        cleaned = parts[1] ?? ""
    }

    // Remove whitespace
    cleaned = cleaned.replace(/\s+/g, "")

    // Convert Base64URL → Base64
    cleaned = cleaned.replace(/-/g, "+").replace(/_/g, "/")

    // Remove invalid characters
    cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, "")

    // Fix padding
    const mod = cleaned.length % 4
    if (mod === 2) cleaned += "=="
    else if (mod === 3) cleaned += "="
    else if (mod === 1) return null // invalid length

    return cleaned
}