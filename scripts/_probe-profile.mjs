/**
 * CPU-profiles the large-PDF load and reports which functions actually hold the main thread.
 *
 *   npm run dev -- --port 5199
 *   node scripts/_probe-profile.mjs fixtures/signed-not-certified.pdf 5199
 */
import path from "node:path"
import { launch, sleep } from "./_cdp.mjs"

const FIXTURE = path.resolve(process.argv[2] ?? "fixtures/signed-not-certified.pdf")
const PORT = process.argv[3] ?? "5199"
const URL = `http://localhost:${PORT}/base64-encode-decode/pdf-verification`

const cdp = await launch({ port: 9405, url: URL })
try {
  await sleep(6000)
  await cdp.send("Profiler.enable")
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 })
  await cdp.send("Profiler.start")

  await cdp.setFile(FIXTURE)
  await sleep(20000)

  const { profile } = (await cdp.send("Profiler.stop")).result

  // Self time per node, from the sample counts.
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const self = new Map()
  const deltas = profile.timeDeltas ?? []
  profile.samples.forEach((id, i) => {
    self.set(id, (self.get(id) ?? 0) + (deltas[i] ?? 0) / 1000)
  })

  const rows = new Map()
  for (const [id, ms] of self) {
    const n = byId.get(id)
    if (!n) continue
    const f = n.callFrame
    const name = f.functionName || "(anonymous)"
    const where = (f.url || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0]
    const key = `${name} — ${where || "(native)"}`
    rows.set(key, (rows.get(key) ?? 0) + ms)
  }

  const sorted = [...rows].sort((a, b) => b[1] - a[1]).filter(([, ms]) => ms >= 40)
  const total = [...rows.values()].reduce((a, b) => a + b, 0)
  console.log(`\n=== MAIN-THREAD SELF TIME (total sampled ${Math.round(total)}ms) ===`)
  for (const [k, ms] of sorted.slice(0, 22)) {
    console.log(`  ${String(Math.round(ms)).padStart(6)}ms  ${k.slice(0, 110)}`)
  }
} finally {
  await cdp.close()
}
