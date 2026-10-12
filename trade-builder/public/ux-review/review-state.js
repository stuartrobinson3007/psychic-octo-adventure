// Seen is tied to both identity and pixels, never approval.
export function seenKey(frame) {
  return `${frame.id}:${frame.currentSha256}`
}

export function loadReviewState() {
  let warning = ''
  const read = (key, fallback, valid) => {
    try {
      const value = JSON.parse(globalThis.localStorage.getItem(key) || 'null')
      if (value === null) return fallback
      if (!valid(value)) throw new Error('Invalid review state')
      return value
    } catch {
      warning = 'Review progress could not be loaded. Changes remain available for this session.'
      return fallback
    }
  }
  const seen = read(
    'gambit-visual-qa-seen-v1',
    [],
    value => Array.isArray(value) && value.every(item => typeof item === 'string')
  )
  const preferences = read(
    'gambit-visual-qa-preferences-v1',
    { navigation: 'axes', widths: 'primary' },
    value =>
      value &&
      ['axes', 'paired'].includes(value.navigation) &&
      ['primary', 'all'].includes(value.widths)
  )
  return { seen: new Set(seen), preferences, warning }
}

export function saveReviewState(key, value) {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value))
    return ''
  } catch {
    return 'Review progress could not be saved. Changes remain available until this page closes.'
  }
}

// Only the foreground, loaded Current image counts. Preloads/contact sheets do not.
export function observeSeen({ image, frame, eligible, onSeen }) {
  let timer
  const cancel = () => globalThis.clearTimeout(timer)
  const schedule = () => {
    cancel()
    const current = frame()
    if (
      !current ||
      !eligible() ||
      globalThis.document.visibilityState !== 'visible' ||
      !globalThis.document.hasFocus() ||
      !image.complete ||
      !image.naturalWidth
    )
      return
    const key = seenKey(current)
    timer = globalThis.setTimeout(() => {
      if (
        frame() &&
        seenKey(frame()) === key &&
        eligible() &&
        globalThis.document.visibilityState === 'visible' &&
        globalThis.document.hasFocus() &&
        image.complete &&
        image.naturalWidth
      ) {
        onSeen(current)
      }
    }, 1000)
  }
  image.addEventListener('load', schedule)
  image.addEventListener('error', cancel)
  globalThis.document.addEventListener('visibilitychange', schedule)
  globalThis.addEventListener('focus', schedule)
  globalThis.addEventListener('blur', cancel)
  return schedule
}
