import type { ReviewScenario } from "./model"

const commit = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** Seed authored checkpoints through the real controls, after opening layout. */
export async function applyChoiceCheckpoint(
  root: HTMLElement,
  state: NonNullable<ReviewScenario["choiceState"]>,
  signal: AbortSignal
) {
  await commit()
  signal.throwIfAborted()
  const choices = root.querySelectorAll<HTMLButtonElement>(
    '[data-slot="selection-group-item"] [data-slot="checkbox"]'
  )
  for (let index = 0; index < (state.select ?? 0); index++) {
    const choice = Array.from(choices).at(index)
    if (!choice) throw new Error("Review selection is unavailable")
    choice.click()
    await commit()
    signal.throwIfAborted()
  }
  if (state.query !== undefined) {
    const search = root.querySelector<HTMLInputElement>(
      '[data-slot="conversation-response"] input[role="searchbox"]'
    )
    if (!search) throw new Error("Review search is unavailable")
    // Use the native setter so React handles this as an ordinary input event.
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(search, state.query)
    search.dispatchEvent(new Event("input", { bubbles: true }))
    await commit()
    signal.throwIfAborted()
    await settleOptions(root, signal)
  }
  if (state.cancel) {
    const cancel = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        '[data-slot="conversation-response"] button'
      )
    ).find((button) => button.textContent.trim() === "Cancel")
    if (!cancel) throw new Error("Review cancellation is unavailable")
    cancel.click()
    await commit()
    signal.throwIfAborted()
  }
}

/** Apply recorded choices by ID through their real controls, including radios. */
export async function applyRecordedChoices(
  root: HTMLElement,
  optionIds: string[],
  signal: AbortSignal
) {
  await commit()
  await settleOptions(root, signal)
  for (const id of optionIds) {
    signal.throwIfAborted()
    const row = Array.from(
      root.querySelectorAll<HTMLElement>("[data-option-id]")
    ).find((element) => element.dataset.optionId === id)
    const control = row?.matches("button")
      ? row
      : row?.querySelector<HTMLElement>('[role="checkbox"]')
    if (!row || !control)
      throw new Error(`Recorded review option is unavailable: ${id}`)
    row.scrollIntoView({ block: "nearest", inline: "nearest" })
    control.click()
    await commit()
  }
}

function settleOptions(root: HTMLElement, signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      observer.disconnect()
      clearTimeout(timeout)
      signal.removeEventListener("abort", abort)
    }
    const check = () => {
      if (
        root.querySelector(
          '[data-slot="clarification-options"][aria-busy="true"]'
        )
      )
        return
      cleanup()
      resolve()
    }
    const abort = () => {
      cleanup()
      reject(signal.reason)
    }
    const observer = new MutationObserver(check)
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Review options did not settle"))
    }, 5000)
    observer.observe(root, { attributes: true, childList: true, subtree: true })
    signal.addEventListener("abort", abort, { once: true })
    check()
  })
}
