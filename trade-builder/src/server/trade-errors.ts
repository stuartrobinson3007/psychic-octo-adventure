import { Schema } from "effect"

export class TradeDomainError extends Schema.TaggedError<TradeDomainError>()(
  "TradeDomainError",
  { message: Schema.String }
) {
  constructor(message: string) {
    super({ message })
  }
}
