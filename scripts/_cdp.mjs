/**
 * Shared CDP harness for the probe scripts.
 *
 * The one thing worth knowing: a bare `list.find(t => t.type === "page")` does NOT find the app.
 * Edge opens `edge://sync-confirmation-dialog/` as a page target and it usually sorts first, so
 * the naive lookup attaches to an empty dialog and every query comes back blank ("No file input
 * on the page."). Always filter down to the http(s) target.
 */
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch({ port = 9401, url }) {
  const profile = await mkdtemp(path.join(tmpdir(), "cdp-"))
  const edge = spawn(
    EDGE,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--disable-gpu",
      "--window-size=1500,950",
      "--disable-features=Translate,CalculateNativeWinOcclusion",
      url,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  )
  const stderr = []
  edge.stderr.on("data", (d) => stderr.push(d.toString()))
  edge.on("error", (e) => stderr.push(`spawn error: ${e.message}`))

  let target
  let lastList = []
  for (let i = 0; i < 100; i++) {
    try {
      lastList = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
      target = lastList.find((t) => t.type === "page" && /^https?:/.test(t.url))
      if (target) break
    } catch {
      /* browser still coming up */
    }
    await sleep(250)
  }
  if (!target) {
    edge.kill()
    const seen = lastList.map((t) => `${t.type} ${t.url}`).join("\n  ") || "(no targets)"
    throw new Error(`Could not attach to the app page.\nTargets:\n  ${seen}\nEdge said: ${stderr.join("").slice(0, 500)}`)
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const events = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id !== undefined) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      p?.(m)
    } else {
      events.push(m)
    }
  }
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id
      pending.set(i, res)
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  const evaluate = async (expression) => {
    const m = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (m.result?.exceptionDetails) {
      return { __error: JSON.stringify(m.result.exceptionDetails).slice(0, 600) }
    }
    return m.result?.result?.value
  }

  await send("Runtime.enable")
  await send("Page.enable")
  await send("DOM.enable")

  const consoleLines = () =>
    events.flatMap((e) => {
      if (e.method === "Runtime.exceptionThrown") {
        const d = e.params.exceptionDetails
        return ["EXCEPTION " + (d.exception?.description ?? d.text)]
      }
      if (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)) {
        return [
          e.params.type.toUpperCase() +
            " " +
            e.params.args.map((a) => a.value ?? a.description ?? "").join(" "),
        ]
      }
      return []
    })

  const setFile = async (file, selector = 'input[type="file"]') => {
    const { root } = (await send("DOM.getDocument", { depth: -1 })).result
    const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector })).result
    if (!nodeId) throw new Error(`No element matching ${selector}`)
    await send("DOM.setFileInputFiles", { nodeId, files: [file] })
  }

  const close = async () => {
    ws.close()
    edge.kill()
    await sleep(400)
    await rm(profile, { recursive: true, force: true }).catch(() => {})
  }

  return { send, evaluate, setFile, events, console: consoleLines, close, profile }
}
