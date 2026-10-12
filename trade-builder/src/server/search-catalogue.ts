import { getConversationStore } from "./conversation-store.ts"
import { TradeDomainError } from "./trade-errors.ts"
import { Schema } from "effect"
import { CatalogueSchema } from "../lib/trade/schemas.ts"
import type { SearchRecord } from "./conversation-records.ts"
import type { Catalogue } from "../lib/trade/types.ts"

export const SEARCH_LIFETIME_MS = 30 * 60 * 1000
const decodeCatalogue = Schema.decodeUnknownSync(
  Schema.fromJsonString(CatalogueSchema)
)

export class SearchExpired extends TradeDomainError {
  constructor() {
    super("This search has expired. Refresh search to load current options.")
  }
}

export function retainSearchCatalogue(
  search: SearchRecord,
  catalogue: Catalogue
) {
  search.createdAt ??= new Date().toISOString()
  search.expiresAt ??= new Date(
    Date.parse(search.createdAt) + SEARCH_LIFETIME_MS
  ).toISOString()
  search.catalogueId = `${catalogue.source}:${catalogue.fetchedAt}`
  getConversationStore().retainSearchCatalogue(
    search.catalogueId,
    JSON.stringify(catalogue),
    Date.parse(search.expiresAt)
  )
  delete search.catalogue
}

export function searchCatalogue(search: SearchRecord): Catalogue {
  const store = getConversationStore()
  const payload =
    search.catalogueId && store.readSearchCatalogue(search.catalogueId)
  const expires = search.expiresAt
    ? Date.parse(search.expiresAt)
    : Date.parse(search.createdAt ?? search.catalogue?.fetchedAt ?? "") +
      SEARCH_LIFETIME_MS
  if (!Number.isFinite(expires) || expires <= Date.now())
    throw new SearchExpired()
  // Older conversations migrate their inline copy on the next session save.
  if (search.catalogue) retainSearchCatalogue(search, search.catalogue)
  const retained =
    payload ||
    (search.catalogueId && store.readSearchCatalogue(search.catalogueId))
  if (!retained) throw new SearchExpired()
  return decodeCatalogue(retained)
}

export function migrateSearchCatalogues(searches: SearchRecord[]) {
  for (const search of searches) {
    if (!search.catalogue) continue
    const created = search.createdAt ?? search.catalogue.fetchedAt
    const expires = search.expiresAt
      ? Date.parse(search.expiresAt)
      : Date.parse(created) + SEARCH_LIFETIME_MS
    search.createdAt = created
    search.expiresAt = new Date(
      Number.isFinite(expires) ? expires : 0
    ).toISOString()
    if (expires > Date.now()) retainSearchCatalogue(search, search.catalogue)
    else delete search.catalogue
  }
}
