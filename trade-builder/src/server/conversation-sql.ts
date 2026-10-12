import { Schema } from "effect"

export class ConversationBusy extends Schema.TaggedError<ConversationBusy>()(
  "ConversationBusy",
  { message: Schema.String }
) {
  constructor(message: string) {
    super({ message })
  }
}
export class ConversationConflict extends Schema.TaggedError<ConversationConflict>()(
  "ConversationConflict",
  { message: Schema.String }
) {
  constructor(message: string) {
    super({ message })
  }
}

export interface ConversationDatabase {
  transaction?: <T>(operation: () => T) => T
  exec: (sql: string) => unknown
  prepare: (sql: string) => {
    get: (
      ...values: Array<string | number>
    ) => Record<string, unknown> | undefined
    run: (...values: Array<string | number>) => { changes: number | bigint }
  }
  close: () => void
}

/** Shared SQL semantics for local SQLite and Cloudflare's durable SQLite. */
export class SqlConversationStore {
  private database: ConversationDatabase
  constructor(database: ConversationDatabase) {
    this.database = database
    database.exec(`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0,
      payload TEXT, owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0
    ); CREATE TABLE IF NOT EXISTS conversation_chunks (conversation_id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(conversation_id,ordinal));
    CREATE TABLE IF NOT EXISTS search_catalogues (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL)`)
  }
  retainSearchCatalogue(id: string, payload: string, expires: number) {
    this.database
      .prepare("DELETE FROM search_catalogues WHERE expires <= ?")
      .run(Date.now())
    this.database
      .prepare(
        `INSERT INTO search_catalogues (id, payload, expires) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET expires = MAX(expires, excluded.expires)`
      )
      .run(id, payload, expires)
  }
  readSearchCatalogue(id: string, now = Date.now()): string | undefined {
    this.database
      .prepare("DELETE FROM search_catalogues WHERE expires <= ?")
      .run(now)
    return this.database
      .prepare("SELECT payload FROM search_catalogues WHERE id = ?")
      .get(id)?.payload as string | undefined
  }
  read(id: string): { version: number; payload: string | null } | undefined {
    const read = () => {
      const row = this.database
        .prepare("SELECT version, payload FROM conversations WHERE id = ?")
        .get(id)
      if (!row) return undefined
      let payload = row.payload as string | null
      if (payload?.startsWith("@chunks:")) {
        const count = Number(payload.slice(8))
        const chunks: string[] = []
        for (let ordinal = 0; ordinal < count; ordinal++) {
          const chunk = this.database
            .prepare(
              "SELECT payload FROM conversation_chunks WHERE conversation_id=? AND ordinal=?"
            )
            .get(id, ordinal)
          if (!chunk)
            throw new ConversationConflict(
              "The saved conversation could not be read. Please reload."
            )
          chunks.push(String(chunk.payload))
        }
        payload = chunks.join("")
      }
      return { version: Number(row.version), payload }
    }
    return this.database.transaction ? this.database.transaction(read) : read()
  }
  claim(id: string, owner: string, now = Date.now(), leaseMs = 60_000) {
    this.database
      .prepare("INSERT OR IGNORE INTO conversations (id) VALUES (?)")
      .run(id)
    const result = this.database
      .prepare(
        "UPDATE conversations SET owner = ?, lease_until = ? WHERE id = ? AND (owner IS NULL OR lease_until <= ?)"
      )
      .run(owner, now + leaseMs, id, now)
    if (!result.changes)
      throw new ConversationBusy(
        "Another request is working on this conversation. Try again shortly."
      )
  }
  save(
    id: string,
    version: number,
    payload: string,
    owner: string,
    now = Date.now()
  ) {
    const chunks: string[] = []
    if (payload.length > 250_000)
      for (let start = 0; start < payload.length;) {
        let end = Math.min(start + 250_000, payload.length)
        const last = payload.charCodeAt(end - 1)
        if (end < payload.length && last >= 0xd800 && last <= 0xdbff) end--
        chunks.push(payload.slice(start, end))
        start = end
      }
    const write = () => {
      const result = this.database
        .prepare(
          "UPDATE conversations SET payload = ?, version = version + 1 WHERE id = ? AND version = ? AND owner = ? AND lease_until > ?"
        )
        .run(
          chunks.length ? `@chunks:${chunks.length}` : payload,
          id,
          version,
          owner,
          now
        )
      if (!result.changes)
        throw new ConversationConflict(
          "The conversation changed before this request could finish."
        )
      this.database
        .prepare("DELETE FROM conversation_chunks WHERE conversation_id=?")
        .run(id)
      chunks.forEach((chunk, ordinal) =>
        this.database
          .prepare(
            "INSERT INTO conversation_chunks (conversation_id,ordinal,payload) VALUES (?,?,?)"
          )
          .run(id, ordinal, chunk)
      )
    }
    if (this.database.transaction) this.database.transaction(write)
    else write()
  }
  release(id: string, owner: string) {
    this.database
      .prepare(
        "UPDATE conversations SET owner = NULL, lease_until = 0 WHERE id = ? AND owner = ?"
      )
      .run(id, owner)
  }
  close() {
    this.database.close()
  }
}
