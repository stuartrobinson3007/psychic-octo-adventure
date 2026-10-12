import { AsyncLocalStorage } from "node:async_hooks"
import type { SqlConversationStore } from "./conversation-sql.ts"

export interface ConversationContext {
  namespace: string
  store: SqlConversationStore
  authorizeChat: () => Promise<string | null>
}
export const conversationContext = new AsyncLocalStorage<ConversationContext>()
export async function authorizeChatTurn(): Promise<string | null> {
  return conversationContext.getStore()?.authorizeChat() ?? null
}
