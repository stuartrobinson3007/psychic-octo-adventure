import assert from "node:assert/strict"
import test from "node:test"
import { Schema } from "effect"
import { TradeService } from "./trade-service.ts"
import { HttpClientError } from "effect/http"
import { contractOptions, get, loadCatalogue } from "./trade-api.ts"
import { InvalidContractOptionsError } from "./contract-options.ts"
import { TradeServiceRequestError } from "./trade-service-http.ts"
import { createTradeRuntime } from "./trade-runtime.ts"
import type { TradeRuntime } from "./trade-runtime.ts"

const serviceOffer = {
  playerId: 42,
  playerName: "Example free agent",
  maxYears: 4,
  maxOfferable: 8_000_000,
  raisePct: 0.05,
  capRoom: 5_000_000,
  tiers: [
    {
      id: "minimum",
      label: "Minimum",
      firstYearSalary: 1_000_000,
      maxYears: 2,
      eligible: true,
      reason: null,
    },
  ],
}

async function withTradeService<T>(
  fetchRequest: typeof fetch,
  operation: (runtime: TradeRuntime) => Promise<T>
): Promise<T> {
  const runtime = createTradeRuntime(fetchRequest)
  try {
    return await operation(runtime)
  } finally {
    await runtime.dispose()
  }
}

test(
  "rejected headers and a stalled JSON body both close their scoped HTTP request",
  { timeout: 2000 },
  async () => {
    const signals: AbortSignal[] = []
    await withTradeService(
      async (_url, init) => {
        assert.ok(init?.signal)
        const signal = init.signal
        signals.push(signal)
        return new Response(
          new ReadableStream({
            start(controller) {
              signal.addEventListener(
                "abort",
                () => controller.error(new Error("Disconnected")),
                { once: true }
              )
            },
          }),
          { status: init.method === "GET" ? 503 : 200 }
        )
      },
      async (runtime) => {
        await assert.rejects(
          get("teams", undefined, runtime),
          TradeServiceRequestError
        )
        assert.equal(signals[0].aborted, true)
        await assert.rejects(
          runtime.runPromise(
            TradeService.use((service) =>
              service.post("trades/validate", { teams: [] }, 25)
            )
          ),
          TradeServiceRequestError
        )
        assert.equal(signals[1].aborted, true)
        assert.equal(signals.length, 2)
      }
    )
  }
)

test("contract options cross the Effect HTTP boundary and retain their funding routes", async () => {
  const requests: string[] = []
  const offer = await withTradeService(
    async (url, init) => {
      requests.push(String(url))
      assert.equal(init?.method, "GET")
      assert.equal(new Headers(init.headers).get("accept"), "application/json")
      return Response.json({ ...serviceOffer, extraServiceField: "ignored" })
    },
    (runtime) => contractOptions(42, 7, undefined, runtime)
  )
  assert.deepEqual(requests, [
    "https://bball-gm.com/api/players/42/contract-options?teamId=7",
  ])
  assert.equal(offer.playerId, 42)
  assert.equal(offer.playerName, "Example free agent")
  assert.equal(offer.tiers[0].reason, undefined)
  assert.deepEqual(
    offer.tiers.map(({ id, firstYearSalary, eligible }) => ({
      id,
      firstYearSalary,
      eligible,
    })),
    [
      { id: "minimum", firstYearSalary: 1_000_000, eligible: true },
      { id: "cap-room", firstYearSalary: 5_000_000, eligible: true },
    ]
  )
})

test("trade POST requests retain business-rule rejections and are not automatically retried", async () => {
  let requests = 0
  await withTradeService(
    async (_url, init) => {
      requests++
      assert.ok(init)
      assert.equal(init.method, "POST")
      assert.equal(
        new Headers(init.headers).get("content-type"),
        "application/json"
      )
      assert.equal(
        await new Response(init.body).text(),
        JSON.stringify({ teams: [] })
      )
      return Response.json(
        { error: "Stepien Rule violation: retained evidence" },
        { status: 400 }
      )
    },
    async (runtime) => {
      const result = await runtime.runPromise(
        TradeService.use((service) =>
          service.post("trades/validate", { teams: [] })
        )
      )
      assert.deepEqual(result, {
        status: 400,
        ok: false,
        body: { error: "Stepien Rule violation: retained evidence" },
      })
      assert.equal(requests, 1)
    }
  )
})

const catalogueResponse = (url: string) =>
  Response.json(
    url.endsWith("/salary-cap")
      ? {
          season: "2026-27",
          salaryCap: 1,
          luxuryTaxLine: 2,
          firstApron: 3,
          secondApron: 4,
        }
      : []
  )

test(
  "one cancelled catalogue subscriber does not cancel another subscriber's shared load",
  { timeout: 2000 },
  async () => {
    let requests = 0
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let notifyStarted = () => {}
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    await withTradeService(
      async (url, init) => {
        requests++
        if (requests === 6) notifyStarted()
        await gate
        assert.equal(init?.signal?.aborted, false)
        return catalogueResponse(String(url))
      },
      async (runtime) => {
        const cancellation = new AbortController()
        const first = assert.rejects(
          loadCatalogue(false, cancellation.signal, runtime)
        )
        const second = loadCatalogue(false, undefined, runtime)
        await started
        cancellation.abort()
        await first
        release()
        const catalogue = await second
        assert.equal(catalogue.cap.season, "2026-27")
        assert.equal(requests, 6)
        assert.deepEqual(
          await loadCatalogue(false, undefined, runtime),
          catalogue
        )
        assert.equal(requests, 6)
        await loadCatalogue(true, undefined, runtime)
        assert.equal(requests, 12)
      }
    )
  }
)

test(
  "cancelling every catalogue subscriber aborts the shared requests and a later load can retry",
  { timeout: 2000 },
  async () => {
    let requests = 0
    let aborted = 0
    let notifyStarted = () => {}
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    let wait = true
    await withTradeService(
      (url, init) => {
        requests++
        if (!wait) return Promise.resolve(catalogueResponse(String(url)))
        return new Promise<Response>((_resolve, reject) => {
          assert.ok(init?.signal)
          const signal = init.signal
          signal.addEventListener(
            "abort",
            () => {
              aborted++
              reject(signal.reason)
            },
            { once: true }
          )
          if (requests === 6) notifyStarted()
        })
      },
      async (runtime) => {
        const cancellation = new AbortController()
        const rejected = assert.rejects(
          loadCatalogue(false, cancellation.signal, runtime)
        )
        await started
        cancellation.abort()
        await rejected
        assert.equal(aborted, 6)
        wait = false
        assert.equal(
          (await loadCatalogue(false, undefined, runtime)).cap.season,
          "2026-27"
        )
        assert.equal(requests, 12)
      }
    )
  }
)

test("validated Bird rights retain their salary ceiling and contract duration", async () => {
  const offer = await withTradeService(
    async () =>
      Response.json({
        ...serviceOffer,
        birdRightsType: "full",
        capRoom: 0,
      }),
    (runtime) => contractOptions(42, 7, undefined, runtime)
  )
  assert.deepEqual(
    offer.tiers.find((tier) => tier.id === "bird-rights"),
    {
      id: "bird-rights",
      label: "Bird rights",
      firstYearSalary: 8_000_000,
      maxYears: 4,
      eligible: true,
      salaryIsMaximum: true,
    }
  )
  assert.equal(
    offer.tiers.some((tier) => tier.id === "cap-room"),
    false
  )
})

test("HTTP 200 responses with malformed contract fields cannot produce funding offers", async () => {
  const invalidResponses = [
    { ...serviceOffer, maxOfferable: "8000000" },
    {
      ...serviceOffer,
      tiers: [{ ...serviceOffer.tiers[0], eligible: "yes" }],
    },
    { ...serviceOffer, playerName: undefined },
  ]
  for (const response of invalidResponses)
    await withTradeService(
      async () => Response.json(response),
      (runtime) =>
        assert.rejects(
          contractOptions(42, 7, undefined, runtime),
          (error: unknown) => {
            assert.ok(error instanceof InvalidContractOptionsError)
            assert.ok(Schema.isSchemaError(error.cause))
            assert.equal(error.playerId, 42)
            assert.equal(
              error.message,
              "Contract options are temporarily unavailable."
            )
            return true
          }
        )
    )
})

test("valid contract data for a different player is rejected before funding offers are returned", async () => {
  await withTradeService(
    async () => Response.json({ ...serviceOffer, playerId: 43 }),
    (runtime) =>
      assert.rejects(
        contractOptions(42, 7, undefined, runtime),
        (error: unknown) => {
          assert.ok(error instanceof InvalidContractOptionsError)
          assert.equal(error.message, "Mismatched contract options.")
          assert.deepEqual(error.cause, {
            expectedPlayerId: 42,
            returnedPlayerId: 43,
          })
          return true
        }
      )
  )
})

test("an unavailable contract service retains its typed cause and safe public message", async () => {
  await withTradeService(
    async () => new Response("private upstream details", { status: 503 }),
    (runtime) =>
      assert.rejects(
        contractOptions(42, 7, undefined, runtime),
        (error: unknown) => {
          assert.ok(error instanceof TradeServiceRequestError)
          assert.equal(error.message, "Player data is temporarily unavailable.")
          assert.ok(HttpClientError.isHttpClientError(error.cause))
          assert.equal(error.cause.response?.status, 503)
          assert.doesNotMatch(error.message, /private upstream details/)
          return true
        }
      )
  )
})

test("malformed contract JSON retains a decoding failure instead of reaching domain normalization", async () => {
  await withTradeService(
    async () => new Response("{broken", { status: 200 }),
    (runtime) =>
      assert.rejects(
        contractOptions(42, 7, undefined, runtime),
        (error: unknown) => {
          assert.ok(error instanceof TradeServiceRequestError)
          assert.ok(HttpClientError.isHttpClientError(error.cause))
          assert.equal(error.cause.reason._tag, "DecodeError")
          return true
        }
      )
  )
})

test(
  "cancelling contract retrieval aborts the underlying fetch",
  { timeout: 2000 },
  async () => {
    const controller = new AbortController()
    let notifyStarted = () => {}
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    let fetchAborted = false
    await withTradeService(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          assert.ok(signal)
          signal.addEventListener(
            "abort",
            () => {
              fetchAborted = true
              reject(signal.reason)
            },
            { once: true }
          )
          notifyStarted()
        }),
      async (runtime) => {
        const pending = contractOptions(42, 7, controller.signal, runtime)
        const rejected = assert.rejects(pending)
        await started
        controller.abort()
        await rejected
        assert.equal(fetchAborted, true)
      }
    )
  }
)

test("independent trade runtimes share each own transport across calls without changing global fetch", async () => {
  const platformFetch = globalThis.fetch
  const firstRequests: string[] = []
  const secondRequests: string[] = []
  const first = createTradeRuntime(async (url) => {
    firstRequests.push(String(url))
    return Response.json({ ...serviceOffer, playerName: "First transport" })
  })
  const second = createTradeRuntime(async (url) => {
    secondRequests.push(String(url))
    return Response.json({ ...serviceOffer, playerName: "Second transport" })
  })
  try {
    const [firstOffer, secondOffer] = await Promise.all([
      contractOptions(42, 7, undefined, first),
      contractOptions(42, 7, undefined, second),
    ])
    assert.equal(firstOffer.playerName, "First transport")
    assert.equal(secondOffer.playerName, "Second transport")
    const json = await get("teams/7", undefined, first)
    assert.deepEqual(json, { ...serviceOffer, playerName: "First transport" })
    assert.deepEqual(firstRequests, [
      "https://bball-gm.com/api/players/42/contract-options?teamId=7",
      "https://bball-gm.com/api/teams/7",
    ])
    assert.deepEqual(secondRequests, [
      "https://bball-gm.com/api/players/42/contract-options?teamId=7",
    ])
    assert.equal(globalThis.fetch, platformFetch)
  } finally {
    await Promise.all([first.dispose(), second.dispose()])
  }
})
