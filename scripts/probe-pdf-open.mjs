/**
 * Does the PDF actually open? Reports the app's own viewer states rather than guessing from
 * canvas counts. Usage: node scripts/probe-pdf-open.mjs <route> <port>
 */
import { spawn } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { PDFDocument, StandardFonts } from "pdf-lib"

const ROUTE = process.argv[2] ?? "pdf-verification"
const PORT = process.argv[3] ?? "5199"
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const BROWSER_INTERNAL = /^(edge|chrome|devtools|chrome-extension):/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  #ws; #id = 0; #pending = new Map(); events = []
  static async attach(port) {
    for (let i = 0; i < 60; i++) {
      try {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
        // Never Edge's own targets — see BROWSER_INTERNAL.
        const p = list.find((t) => t.type === "page" && !BROWSER_INTERNAL.test(t.url))
        if (p) return new CDP(p.webSocketDebuggerUrl)
      } catch {}
      await sleep(250)
    }
    throw new Error("no attach")
  }
  constructor(url) {
    this.#ws = new WebSocket(url)
    this.#ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id !== undefined) { const p = this.#pending.get(m.id); this.#pending.delete(m.id); m.error ? p?.reject(new Error(m.error.message)) : p?.resolve(m.result) }
      else this.events.push(m)
    }
    this.ready = new Promise((res, rej) => { this.#ws.onopen = res; this.#ws.onerror = rej })
  }
  send(method, params = {}) {
    const id = ++this.#id
    return new Promise((resolve, reject) => { this.#pending.set(id, { resolve, reject }); this.#ws.send(JSON.stringify({ id, method, params })) })
  }
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw new Error(exceptionDetails.text)
    return result.value
  }
  close() { this.#ws.close() }
}

// Reads the exact states PdfViewerContent can render.
const VIEWER_STATE = `(() => {
  const text = document.body.innerText
  return {
    loading:      text.includes('Loading PDF'),
    unavailable:  text.includes('PDF preview unavailable'),
    stillEmpty:   text.includes('Encode PDFs to Base64') || text.includes('Verify a signed PDF'),
    errorDetail:  [...document.querySelectorAll('p')].map(p=>p.textContent).find(t => t && /unsupported|expected|failed|error|invalid|worker|wasm|could not/i.test(t)) ?? null,
    canvases:     document.querySelectorAll('canvas').length,
    canvasPixels: [...document.querySelectorAll('canvas')].map(c => c.width + 'x' + c.height),
    textareaLens: [...document.querySelectorAll('textarea')].map(t => t.value.length),
    bodyText:     text.replace(/\\s+/g,' ').slice(0, 220),
  }
})()`

const profile = await mkdtemp(path.join(tmpdir(), "pdfopen-"))
const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
for (let i = 0; i < 3; i++) doc.addPage([612, 792]).drawText(`Hello page ${i + 1}`, { x: 72, y: 700, size: 28, font })
const pdf = path.join(profile, "p.pdf")
await writeFile(pdf, await doc.save())

const edge = spawn(EDGE, [
  "--headless=new", "--remote-debugging-port=9228",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "--window-size=1500,950", "about:blank",
])

let cdp
try {
  cdp = await CDP.attach(9228)
  await cdp.ready
  await cdp.send("Runtime.enable"); await cdp.send("Page.enable"); await cdp.send("DOM.enable"); await cdp.send("Network.enable")

  console.log(`\nroute: ${ROUTE}   port: ${PORT}\n`)
  await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/base64-encode-decode/${ROUTE}` })
  await sleep(Number(process.env.PREWAIT ?? 5000))

  const { root } = await cdp.send("DOM.getDocument", { depth: -1 })
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: 'input[type="file"]' })
  if (!nodeId) throw new Error("no file input found")
  await cdp.send("DOM.setFileInputFiles", { nodeId, files: [pdf] })

  for (const t of [1500, 3000, 5000, 9000]) {
    await sleep(t === 1500 ? 1500 : t - (t === 3000 ? 1500 : t === 5000 ? 3000 : 5000))
    console.log(`  +${String(t).padStart(5)}ms  ${JSON.stringify(await cdp.evaluate(VIEWER_STATE))}  vk=${JSON.stringify(await cdp.evaluate("window.__vk ?? null"))}`)
  }

  // If nothing rendered, is it a measurement race? A resize forces the viewer to re-measure its
  // container; pages appearing afterwards means the container was zero-sized when it first looked.
  const zero = await cdp.evaluate("document.querySelectorAll('canvas').length === 0")
  if (zero) {
    console.log("\n  0 canvases - probing why")
    console.log("  container:", JSON.stringify(await cdp.evaluate(`(() => {
      const el = document.querySelector('[class*=vk-], [class*=verifykit], main, [role=main]') || document.body
      const r = el.getBoundingClientRect()
      return { tag: el.tagName, cls: (el.className||'').toString().slice(0,60), w: Math.round(r.width), h: Math.round(r.height) }
    })()`)))
    await cdp.evaluate("window.dispatchEvent(new Event('resize'))")
    await sleep(2000)
    console.log("  after resize:", JSON.stringify(await cdp.evaluate(VIEWER_STATE)))
    console.log("  verification:", JSON.stringify(await cdp.evaluate("window.__vk ?? 'absent'")))
  }

  // Any network request that failed (worker, wasm, cmaps). Resolve ids back to URLs.
  const urlById = new Map(
    cdp.events
      .filter((e) => e.method === "Network.requestWillBeSent")
      .map((e) => [e.params.requestId, e.params.request.url])
  )
  const failed = cdp.events
    .filter((e) => e.method === "Network.loadingFailed")
    .map((e) => `${e.params.errorText} <- ${urlById.get(e.params.requestId) ?? "?"}`)
  const responses = cdp.events
    .filter((e) => e.method === "Network.responseReceived" && e.params.response.status >= 400)
    .map((e) => `${e.params.response.status} ${e.params.response.url.split("/").slice(-2).join("/")}`)

  console.log(`\nfailed requests: ${failed.length ? failed.join(", ") : "none"}`)
  console.log(`4xx/5xx: ${responses.length ? responses.join(", ") : "none"}`)

  const msgs = cdp.events.flatMap((e) => {
    if (e.method === "Runtime.exceptionThrown") return [`EXCEPTION ${(e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text).slice(0, 400)}`]
    if (e.method === "Runtime.consoleAPICalled")
      return [`${e.params.type} ${e.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 250)}`]
    return []
  })
  console.log(`\nconsole (${msgs.length}):`)
  for (const m of msgs.slice(0, 25)) console.log("  " + m)
} finally {
  cdp?.close(); edge.kill(); await sleep(500)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
