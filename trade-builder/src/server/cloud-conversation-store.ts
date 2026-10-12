import { conversationContext } from "./conversation-context.ts"

export { ConversationBusy, ConversationConflict } from "./conversation-sql.ts"

function context() {
  const scope = conversationContext.getStore()
  if (!scope) throw new Error("A verified browser session is required.")
  return scope
}
export const getConversationStore = () => context().store
export const scopeSessionId = (id: string) => `${context().namespace}:${id}`
