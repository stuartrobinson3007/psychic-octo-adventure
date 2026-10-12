import { Miniflare, convertV4MiniflareOptions } from "miniflare"
import { resolve } from "node:path"
import { readdirSync } from "node:fs"
import assert from "node:assert/strict"
// A fresh local Worker runtime exercises real Durable Object RPC without calling a model.
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "gambit-guard-test",
        modules: [
          {
            type: "ESModule",
            path: resolve("dist-cloudflare/server/index.js"),
          },
          ...readdirSync("dist-cloudflare/server/assets")
            .filter((x) => x.endsWith(".js"))
            .map((name) => ({
              type: "ESModule",
              path: resolve("dist-cloudflare/server/assets", name),
            })),
        ],
        modulesRoot: resolve("dist-cloudflare/server"),
        compatibilityDate: "2026-10-08",
        compatibilityFlags: ["nodejs_compat"],
        durableObjects: {
          GUARD: { className: "UsageGuard", useSQLite: true },
          WORKSPACES: { className: "BrowserWorkspace", useSQLite: true },
        },
      },
    ],
  })
)
try {
  const { GUARD } = await mf.getBindings()
  const guard = GUARD.get(GUARD.idFromName("test-quotas"))
  assert.equal(await guard.allow("password-test", 2, 900000), true)
  assert.equal(await guard.allow("password-test", 2, 900000), true)
  assert.equal(await guard.allow("password-test", 2, 900000), false)
  for (let i = 0; i < 3; i++)
    assert.equal(await guard.chat("same-browser"), null)
  assert.match(await guard.chat("same-browser"), /wait a minute/)
  for (let i = 0; i < 297; i++)
    assert.equal(await guard.chat("browser-" + i), null)
  assert.match(await guard.chat("fresh-browser"), /shared chat limit/)
  console.log(
    "Passed atomic password attempt limits, per-browser minute limit and the 300-turn global cap across distinct browser identities."
  )
} finally {
  await mf.dispose()
}
