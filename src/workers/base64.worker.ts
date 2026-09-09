import { base64ToBytes, bytesToBase64 } from "@/utils/base64"

export type Base64WorkerRequest =
  | { id: number; kind: "encode-file"; file: File }
  | { id: number; kind: "encode-text"; text: string }
  | { id: number; kind: "decode"; value: string }

export type Base64WorkerResponse =
  | { id: number; ok: true; kind: "string"; value: string }
  | { id: number; ok: true; kind: "bytes"; value: ArrayBuffer }
  | { id: number; ok: false; error: string }

/**
 * `lib` is set to DOM rather than WebWorker in tsconfig.app.json, so the worker globals are not
 * typed. Only two members are used here, and naming them keeps the calls type-checked.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<Base64WorkerRequest>) => void) | null
  postMessage(message: Base64WorkerResponse, transfer?: Transferable[]): void
}

const ctx = self as unknown as WorkerScope

/**
 * `readAsDataURL` is the browser's native Base64 encoder — dramatically faster than anything
 * reachable from JavaScript. FileReader is available inside workers, so this gets native speed
 * *and* keeps the main thread free.
 */
function encodeFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const comma = result.indexOf(",")
      resolve(comma === -1 ? result : result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error("File could not be read."))

    reader.readAsDataURL(file)
  })
}

ctx.onmessage = async (event) => {
  const request = event.data

  try {
    switch (request.kind) {
      case "encode-file": {
        ctx.postMessage({ id: request.id, ok: true, kind: "string", value: await encodeFile(request.file) })
        break
      }
      case "encode-text": {
        const value = bytesToBase64(new TextEncoder().encode(request.text))
        ctx.postMessage({ id: request.id, ok: true, kind: "string", value })
        break
      }
      case "decode": {
        const buffer = base64ToBytes(request.value).buffer
        // Transferred rather than copied — the worker has no further use for it.
        ctx.postMessage({ id: request.id, ok: true, kind: "bytes", value: buffer }, [buffer])
        break
      }
    }
  } catch (error) {
    ctx.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : "Conversion failed.",
    })
  }
}
