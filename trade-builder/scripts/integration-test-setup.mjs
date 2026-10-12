// Local integration checks use isolated storage and injected service responses.
process.env.GAMBIT_CONVERSATION_DB = ":memory:"
delete process.env.OPENAI_API_KEY
globalThis.fetch = async () => {
  throw new Error(
    "Integration tests must inject service responses; live network requests are disabled."
  )
}
