import type { Base64WorkerRequest, Base64WorkerResponse } from "@/workers/base64.worker"
import { base64ToBytes, bytesToBase64, type Bytes } from "./base64"

/** Plain `Omit` on a union collapses it to the keys they share; this keeps the variants apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * Below this size the work finishes in a few milliseconds and the worker round trip — plus
 * structured-cloning the payload twice — costs more than it saves.
 */
const WORKER_THRESHOLD = 256 * 1024

interface Pending {
  resolve: (response: Base64WorkerResponse) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let workerUnavailable = false
let nextId = 0
const pending = new Map<number, Pending>()

function getWorker(): Worker | null {
  if (workerUnavailable) return null
  if (worker) return worker

  try {
    worker = new Worker(new URL("../workers/base64.worker.ts", import.meta.url), { type: "module" })

    worker.onmessage = (event: MessageEvent<Base64WorkerResponse>) => {
      const entry = pending.get(event.data.id)
      if (!entry) return
      pending.delete(event.data.id)
      entry.resolve(event.data)
    }

    // A worker-level error leaves every in-flight request unanswerable. Fail them, drop the
    // worker, and let subsequent calls fall back to the main thread rather than hanging.
    worker.onerror = () => {
      const failed = [...pending.values()]
      pending.clear()
      worker?.terminate()
      worker = null
      workerUnavailable = true
      failed.forEach((entry) => entry.reject(new Error("Base64 worker stopped unexpectedly.")))
    }

    return worker
  } catch {
    workerUnavailable = true
    return null
  }
}

/**
 * Returns null when the worker is unavailable or died mid-request, which sends the caller down
 * the main-thread path. A worker that stops should cost smoothness, not the conversion itself.
 * Genuine conversion failures come back as `ok: false` and are re-thrown by the callers.
 */
async function send(
  message: DistributiveOmit<Base64WorkerRequest, "id">
): Promise<Base64WorkerResponse | null> {
  const active = getWorker()
  if (!active) return null

  const id = nextId++

  try {
    return await new Promise<Base64WorkerResponse>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      active.postMessage({ ...message, id } as Base64WorkerRequest)
    })
  } catch {
    pending.delete(id)
    return null
  }
}

function expectString(response: Base64WorkerResponse): string {
  if (!response.ok) throw new Error(response.error)
  if (response.kind !== "string") throw new Error("Unexpected worker response.")
  return response.value
}

function expectBytes(response: Base64WorkerResponse): Bytes {
  if (!response.ok) throw new Error(response.error)
  if (response.kind !== "bytes") throw new Error("Unexpected worker response.")
  return new Uint8Array(response.value)
}

/** Read a file and return its raw Base64, without the Data URI header. */
export async function encodeFileToBase64(file: File): Promise<string> {
  if (file.size >= WORKER_THRESHOLD) {
    const response = await send({ kind: "encode-file", file })
    if (response) return expectString(response)
  }

  return bytesToBase64(new Uint8Array(await file.arrayBuffer()))
}

export async function encodeTextToBase64(text: string): Promise<string> {
  if (text.length >= WORKER_THRESHOLD) {
    const response = await send({ kind: "encode-text", text })
    if (response) return expectString(response)
  }

  return bytesToBase64(new TextEncoder().encode(text))
}

export async function decodeBase64ToBytes(value: string): Promise<Bytes> {
  if (value.length >= WORKER_THRESHOLD) {
    const response = await send({ kind: "decode", value })
    if (response) return expectBytes(response)
  }

  return base64ToBytes(value)
}

export async function decodeBase64ToText(value: string): Promise<string> {
  return new TextDecoder().decode(await decodeBase64ToBytes(value))
}
