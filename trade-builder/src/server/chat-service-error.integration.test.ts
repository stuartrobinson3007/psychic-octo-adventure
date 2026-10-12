import assert from "node:assert/strict"
import test from "node:test"
import { OpenAIAdkModel } from "./openai-adk-model.ts"
import { chatFailure } from "./chat-service-error.ts"

test("the ADK OpenAI adapter stops after one request for exhausted credits, without leaking provider details", async () => {
  let requests = 0
  const model = new OpenAIAdkModel({
    model: "local-integration-model",
    apiKey: "test-key",
    fetchRequest: async () => {
      requests++
      return Response.json(
        {
          error: {
            code: "insufficient_quota",
            type: null,
            message: "You have no credits remaining. private provider details",
          },
        },
        { status: 429 }
      )
    },
  })
  const error = await model
    .generateContentAsync({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      toolsDict: {},
      config: {},
      liveConnectConfig: {},
    })
    .next()
    .then(
      () => assert.fail("Expected an account failure"),
      (failure) => failure
    )
  assert.equal(requests, 1)
  assert.equal(chatFailure(error).kind, "credits")
  assert.equal(chatFailure(error).status, "agent_unavailable")
  assert.doesNotMatch(chatFailure(error).message, /private provider details/)
})
