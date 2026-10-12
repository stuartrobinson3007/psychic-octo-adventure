/** Presentation contracts used by the local React components. */
export type MessageRole = "system" | "user" | "assistant"
export type PromptStatus = "submitted" | "streaming" | "ready" | "error"

export interface PromptFile {
  type: "file"
  mediaType: string
  filename?: string
  url: string
}

export interface PromptSource {
  type: "source-document"
  sourceId: string
  mediaType: string
  title: string
  filename?: string
}

export interface TranscriptMessage {
  id?: string
  role: MessageRole
  parts: ReadonlyArray<{ type: string; text?: string }>
}
