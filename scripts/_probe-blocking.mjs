/**
 * Measures where the wall-clock goes when a large PDF is loaded, and how much of it is
 * main-thread blocking (the part that makes the UI feel frozen).
 *
 *   npm run dev -- --port 5199
 *   node scripts/_probe-blocking.mjs fixtures/signed-not-certified.pdf 5199
 */
import path from "node:path"
import { launch, sleep } from "./_cdp.mjs"

const FIXTURE = path.resolve(process.argv[2] ?? "fixtures/signed-not-certified.pdf")
const PORT = process.argv[3] ?? "5199"
const URL = `http://localhost:${PORT}/base64-encode-decode/pdf-verification`

/**
 * A long task is anything holding the main thread >50ms — during one, nothing repaints and no
 * click is handled. Also poll the rendered viewer state so the blocking can be lined up with
 * what the user was looking at.
 */
const INSTALL = `(() => {
  window.__probe = { tasks: [], marks: [], t0: performance.now() }
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__probe.tasks.push({ at: Math.round(e.startTime - window.__probe.t0), ms: Math.round(e.duration) })
    }
  }).observe({ entryTypes: ['longtask'] })

  let last = ''
  setInterval(() => {
    const text = document.body.innerText
    const state =
      text.includes('Loading PDF') ? 'spinner' :
      document.querySelector('canvas') ? 'rendered' :
      text.includes('PDF preview unavailable') ? 'error' : 'idle'
    const verdict = /Signed and all signatures are valid|At least one signature has problems/.test(text)
    const key = state + (verdict ? '+verdict' : '')
    if (key !== last) {
      last = key
      window.__probe.marks.push({ at: Math.round(performance.now() - window.__probe.t0), state: key })
    }
  }, 50)
  return 'installed'
})()`

const cdp = await launch({ port: 9404, url: URL })
try {
  await sleep(6000)
  console.log(await cdp.evaluate(INSTALL))
  await cdp.evaluate(`window.__probe.t0 = performance.now(); window.__probe.tasks.length = 0; window.__probe.marks.length = 0; 'reset'`)

  await cdp.setFile(FIXTURE)
  await sleep(25000)

  const r = await cdp.evaluate(`(() => {
    const p = window.__probe
    const total = p.tasks.reduce((a, t) => a + t.ms, 0)
    return { tasks: p.tasks, marks: p.marks, total, count: p.tasks.length }
  })()`)

  console.log("\n=== UI STATE TIMELINE (ms after file chosen) ===")
  for (const m of r.marks) console.log(`  ${String(m.at).padStart(6)}ms  ${m.state}`)

  console.log(`\n=== LONG TASKS (>50ms) — ${r.count} tasks, ${r.total}ms total blocking ===`)
  for (const t of r.tasks.filter((t) => t.ms >= 50).sort((a, b) => b.ms - a.ms).slice(0, 15)) {
    console.log(`  ${String(t.ms).padStart(6)}ms  starting at +${t.at}ms`)
  }
  const worst = r.tasks.reduce((m, t) => Math.max(m, t.ms), 0)
  console.log(`\nlongest single freeze: ${worst}ms`)
} finally {
  await cdp.close()
}
