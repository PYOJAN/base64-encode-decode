export function textToBase64(text: string): string {
  return btoa(
    new TextEncoder()
      .encode(text)
      .reduce((acc, byte) => acc + String.fromCharCode(byte), "")
  )
}

export function base64ToText(b64: string): string {
  const binaryString = atob(b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export function base64ToBlob(b64: string, mimeType = "application/octet-stream"): Blob {
  const byteCharacters = atob(b64)
  const byteNumbers = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  return new Blob([byteNumbers], { type: mimeType })
}

export function extractBase64Data(input: string): { data: string; mimeType: string | null } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { data: match[2]!, mimeType: match[1]! }
  }
  return { data: input.trim(), mimeType: null }
}
