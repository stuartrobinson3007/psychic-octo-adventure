import { Effect, Schema } from "effect"
import type { HttpClient } from "effect/http"
import { readTradeServiceJson } from "./trade-service-http.ts"
import type { TradeServiceRequestError } from "./trade-service-http.ts"

const ContractTierResponse = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  firstYearSalary: Schema.Finite,
  maxYears: Schema.Finite,
  eligible: Schema.Boolean,
  reason: Schema.optionalKey(Schema.NullOr(Schema.String)),
})

export const ContractOptionsResponse = Schema.Struct({
  playerId: Schema.Finite,
  playerName: Schema.String,
  maxYears: Schema.Finite,
  maxOfferable: Schema.Finite,
  raisePct: Schema.Finite,
  capRoom: Schema.Finite,
  birdRightsType: Schema.optionalKey(Schema.NullOr(Schema.String)),
  tiers: Schema.Array(ContractTierResponse),
})

const decodeContractOptionsResponse = Schema.decodeUnknownEffect(
  ContractOptionsResponse
)

export interface ContractOptions {
  playerId: number
  playerName: string
  maxYears: number
  maxOfferable: number
  raisePct: number
  tiers: Array<{
    id: string
    label: string
    firstYearSalary: number
    maxYears: number
    eligible: boolean
    /** Funding routes allow any checked amount up to this ceiling. */
    salaryIsMaximum?: boolean
    reason?: string
  }>
}

export class InvalidContractOptionsError extends Schema.TaggedError<InvalidContractOptionsError>()(
  "InvalidContractOptionsError",
  {
    playerId: Schema.Finite,
    message: Schema.String,
    cause: Schema.Defect(),
  }
) {}

export const readContractOptions = Effect.fn("readContractOptions")(function* (
  playerId: number,
  teamId: number
): Effect.fn.Return<
  ContractOptions,
  TradeServiceRequestError | InvalidContractOptionsError,
  HttpClient.HttpClient
> {
  const json = yield* readTradeServiceJson(
    `players/${playerId}/contract-options?teamId=${teamId}`
  )
  const raw = yield* decodeContractOptionsResponse(json).pipe(
    Effect.mapError(
      (cause) =>
        new InvalidContractOptionsError({
          playerId,
          message: "Contract options are temporarily unavailable.",
          cause,
        })
    )
  )
  if (raw.playerId !== playerId)
    return yield* new InvalidContractOptionsError({
      playerId,
      message: "Mismatched contract options.",
      cause: { expectedPlayerId: playerId, returnedPlayerId: raw.playerId },
    })
  return {
    playerId,
    playerName: raw.playerName,
    maxYears: raw.maxYears,
    maxOfferable: raw.maxOfferable,
    raisePct: raw.raisePct,
    tiers: [
      ...raw.tiers.map((tier) => ({
        id: tier.id,
        label: tier.label,
        firstYearSalary: tier.firstYearSalary,
        maxYears: tier.maxYears,
        eligible: tier.eligible,
        reason: tier.reason ?? undefined,
      })),
      ...(raw.birdRightsType === "full"
        ? [
            {
              id: "bird-rights",
              label: "Bird rights",
              firstYearSalary: raw.maxOfferable,
              maxYears: raw.maxYears,
              eligible: true,
              salaryIsMaximum: true,
            },
          ]
        : []),
      ...(raw.capRoom > 0
        ? [
            {
              id: "cap-room",
              label: "Cap room",
              firstYearSalary: Math.min(raw.capRoom, raw.maxOfferable),
              maxYears: Math.min(4, raw.maxYears),
              eligible: true,
              salaryIsMaximum: true,
            },
          ]
        : []),
    ],
  }
})
