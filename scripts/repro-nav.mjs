/**
 * Reproduces the reported navigation bug in a real browser via CDP, no test deps.
 *
 *   1. npm run dev -- --port 5199
 *   2. node scripts/repro-nav.mjs [route]
 *
 * Loads a PDF on the given route, clicks a sidebar link, and reports whether the page actually
 * navigated along with anything the console said.
 */
import { spawn } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { PDFDocument, StandardFonts } from "pdf-lib"

const ROUTE = process.argv[2] ?? "pdf-to-base64"
const PORT = process.argv[3] ?? "5199"
// How long to let the viewer settle before navigating. Navigating mid-load is the interesting
// case: that is when a router transition has the most reason to get stuck.
const SETTLE_MS = Number(process.argv[4] ?? 7000)
const APP = `http://localhost:${PORT}/base64-encode-decode/${ROUTE}`
const TARGET_ROUTE = "json-formatter"
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const BROWSER_INTERNAL = /^(edge|chrome|devtools|chrome-extension):/

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function makePdf(file) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([612, 792])
    page.drawText(`Repro page ${i + 1}`, { x: 72, y: 700, size: 24, font })
  }
  await writeFile(file, await doc.save())
  return file
}

class CDP {
  #ws
  #id = 0
  #pending = new Map()
  events = []

  static async attach(port) {
    for (let i = 0; i < 60; i++) {
      try {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
        // Skip Edge's own page targets (edge://sync-confirmation-dialog is the usual
        // culprit, and it sorts first). Attaching to one of those makes every query come
        // back empty, which reads as "the app rendered nothing" rather than "wrong target".
        const page = list.find((t) => t.type === "page" && !BROWSER_INTERNAL.test(t.url))
        if (page) return new CDP(page.webSocketDebuggerUrl)
      } catch {
        /* browser still starting */
      }
      await sleep(250)
    }
    throw new Error("Could not attach to the browser.")
  }

  constructor(url) {
    this.#ws = new WebSocket(url)
    this.#ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id !== undefined) {
        const p = this.#pending.get(msg.id)
        this.#pending.delete(msg.id)
        msg.error ? p?.reject(new Error(msg.error.message)) : p?.resolve(msg.result)
      } else {
        this.events.push(msg)
      }
    }
    this.ready = new Promise((resolve, reject) => {
      this.#ws.onopen = resolve
      this.#ws.onerror = reject
    })
  }

  send(method, params = {}) {
    const id = ++this.#id
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.text + " " + (exceptionDetails.exception?.description ?? ""))
    return result.value
  }

  close() {
    this.#ws.close()
  }
}

function describeConsole(events) {
  const out = []
  for (const e of events) {
    if (e.method === "Runtime.exceptionThrown") {
      out.push(`EXCEPTION  ${e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text}`)
    }
    if (e.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(e.params.type)) {
      out.push(`${e.params.type.toUpperCase().padEnd(10)} ${e.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`)
    }
  }
  return out
}

const profile = await mkdtemp(path.join(tmpdir(), "repro-edge-"))
const pdf = await makePdf(path.join(profile, "repro.pdf"))

const edge = spawn(EDGE, [
  "--headless=new",
  "--remote-debugging-port=9222",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-gpu",
  "--window-size=1400,900",
  "about:blank",
])

let cdp
try {
  cdp = await CDP.attach(9222)
  await cdp.ready
  await cdp.send("Runtime.enable")
  await cdp.send("Page.enable")
  await cdp.send("DOM.enable")

  console.log(`\nrouting to ${APP}`)
  await cdp.send("Page.navigate", { url: APP })
  await sleep(4000)

  // Feed the PDF into the page's file input.
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 })
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: 'input[type="file"]',
  })
  if (!nodeId) throw new Error("No file input on the page.")
  await cdp.send("DOM.setFileInputFiles", { nodeId, files: [pdf] })
  console.log("PDF handed to the file input")

  await sleep(SETTLE_MS)

  const loaded = await cdp.evaluate(`(() => ({
    canvases: document.querySelectorAll('canvas').length,
    path: location.pathname,
    heading: document.querySelector('h1')?.textContent ?? null,
  }))()`)
  console.log("after load:", JSON.stringify(loaded))

  // Click a sidebar link the way a user would.
  const clicked = await cdp.evaluate(`(() => {
    const a = [...document.querySelectorAll('a')].find(a => a.getAttribute('href')?.endsWith('/${TARGET_ROUTE}'))
    if (!a) return 'link not found'
    a.click()
    return a.getAttribute('href')
  })()`)
  console.log("clicked:", clicked)

  for (const wait of [1000, 3000, 6000]) {
    await sleep(wait === 1000 ? 1000 : wait - 1000)
    const state = await cdp.evaluate(`(() => ({
      path: location.pathname,
      heading: document.querySelector('h1')?.textContent ?? null,
      canvases: document.querySelectorAll('canvas').length,
      header: document.querySelector('header span')?.textContent ?? null,
    }))()`)
    console.log(`  +${wait}ms`, JSON.stringify(state))
  }

  const messages = describeConsole(cdp.events)
  console.log(`\nconsole (${messages.length} error/warning entries)`)
  for (const m of messages.slice(0, 25)) console.log("  " + m)
} finally {
  cdp?.close()
  edge.kill()
  await sleep(500)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
