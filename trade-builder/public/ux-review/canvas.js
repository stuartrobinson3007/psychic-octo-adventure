import { loadReviewState, saveReviewState, seenKey } from './review-state.js'
import { journeyModel } from './journey-model.js'

const $ = id => document.getElementById(id)
const edgeTooltip = document.createElement('div')
edgeTooltip.id = 'edge-tooltip'
edgeTooltip.setAttribute('role', 'tooltip')
edgeTooltip.hidden = true
document.body.append(edgeTooltip)
const hideEdgeTooltip = () => { edgeTooltip.hidden = true }
function showEdgeTooltip(label) {
  edgeTooltip.textContent = label.textContent
  edgeTooltip.hidden = false
  const box = label.getBoundingClientRect()
  const tooltipBox = edgeTooltip.getBoundingClientRect()
  edgeTooltip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - tooltipBox.width - 8))}px`
  edgeTooltip.style.top = `${Math.max(8, box.top >= tooltipBox.height + 16 ? box.top - tooltipBox.height - 8 : Math.min(box.bottom + 8, innerHeight - tooltipBox.height - 8))}px`
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideEdgeTooltip()
})
const review = loadReviewState()
const state = {
  manifest: null,
  groups: [],
  filter: 'all',
  zoom: 0.75,
  overview: true,
  pixels: false,
  x: 30,
  y: 40,
  selected: null,
  element: null,
  inspecting: false,
  elements: new Map(),
  preferences: review.preferences,
  seen: review.seen,
  flags: new Set(),
  elementFlags: [],
  cards: [],
  centreFrame: null,
  dwell: null,
}
const warn = message => {
  $('storage-warning').textContent = message
}
if (review.warning) warn(review.warning)
try {
  state.flags = new Set(JSON.parse(localStorage.getItem('gambit-visual-qa-flags') || '[]'))
  state.elementFlags = JSON.parse(localStorage.getItem('gambit-visual-qa-element-flags-v1') || '[]')
  if (
    !Array.isArray(state.elementFlags) ||
    state.elementFlags.some(flag => !flag || typeof flag.frameId !== 'string')
  )
    state.elementFlags = []
} catch {
  warn('Saved flags could not be loaded.')
}
const save = (key, value) => {
  const warning = saveReviewState(key, value)
  if (warning) warn(warning)
}
const widths = () =>
  state.preferences.widths === 'all'
    ? ['desktop', 'mobile', 'tablet', 'laptop']
    : ['desktop', 'mobile']
const isFlagged = frame =>
  state.flags.has(frame.id) ||
  state.elementFlags.some(
    flag => flag.frameId === frame.id && flag.pixelSha256 === frame.currentSha256
  )
const previewScale = frame => frame.width > 600 ? 0.4 : 0.8
const screenHeight = frame => frame.height * previewScale(frame) + 67
const matches = frame =>
  state.filter === 'all' ||
  (state.filter === 'unseen' && !state.seen.has(seenKey(frame))) ||
  (state.filter === 'affected' && frame.affected) ||
  (state.filter === 'flagged' && isFlagged(frame))
const frames = () =>
  state.groups.flatMap(group =>
    widths().flatMap(width => group.frames.filter(frame => frame.viewport === width))
  )

function progress() {
  const scoped = frames()
  $('progress').textContent =
    `${scoped.filter(frame => state.seen.has(seenKey(frame))).length} / ${scoped.length} seen`
  for (const { card, frame } of state.cards) {
    card.classList.toggle('seen', state.seen.has(seenKey(frame)))
    card.classList.toggle('flagged', isFlagged(frame))
    card.querySelector('.screen-status').textContent =
      `${state.seen.has(seenKey(frame)) ? 'Seen' : 'Unseen'}${isFlagged(frame) ? ' · Flagged' : ''}`
  }
  if (state.selected)
    $('selected-state').textContent =
      `${state.selected.stepId} · ${state.selected.viewportLabel} · ${state.seen.has(seenKey(state.selected)) ? 'Seen' : 'Unseen'}`
}

function ref() {
  return state.selected
    ? {
        runId: state.manifest.runId,
        revision: state.selected.livePreviewUrl && (!state.pixels || !state.selected.captured) ? undefined : state.manifest.revision,
        frameId: state.selected.id,
        previewUrl: state.selected.livePreviewUrl,
        pixelSha256: state.pixels && state.selected.captured ? state.selected.currentSha256 : undefined,
        domSha256: state.selected.livePreviewUrl && !state.pixels ? undefined : state.selected.domSnapshot?.sha256,
        element: state.element,
        note: $('note').value,
        mode: state.selected.livePreviewUrl && (!state.pixels || !state.selected.captured) ? 'live-dom-inspection' : 'frozen-dom-inspection',
      }
    : null
}
function showRef() {
  $('reference').textContent = JSON.stringify(ref(), null, 2) || 'Select a screen.'
}

function select(frame) {
  if (state.selected?.id !== frame.id) $('note').value = ''
  state.selected = frame
  state.element = null
  $('selected-context').hidden = false
  $('selected-title').textContent = frame.scenarioTitle
  $('selected-brief').textContent = frame.scenarioDescription
  $('selected-request-label').textContent = frame.fixtureBasis ? 'Shared fixture data' : 'Request'
  $('selected-request').textContent = frame.requestText || frame.fixtureBasis || 'Authored UI state'
  $('selected-outcome').textContent = frame.stateLabel || frame.checkpointLabel
  const live = frame.livePreviewUrl && (!state.pixels || !frame.captured)
  $('limitations').textContent = live ? (frame.recording
    ? `${frame.recording.current ? 'Current backend recording' : 'Earlier backend recording'} · ${new Date(frame.recording.recordedAt).toLocaleString()}. Live UI preview.`
    : 'Authored fixture. Live UI preview.') : frame.domSnapshot
    ? frame.domSnapshot.limitations.join(' ')
    : 'Older image-only capture. Recapture to inspect DOM elements.'
  $('flag').textContent = isFlagged(frame) ? 'Flagged' : 'Flag'
  $('inspect').disabled = live ? false : state.pixels || !frame.domSnapshot
  $('open-app').disabled =
    state.previewBusy ||
    state.previewEnabled === false ||
    state.manifest.suite === 'demo' ||
    (state.replayableScenarioIds && !state.replayableScenarioIds.includes(frame.scenarioId))
  $('open-app').title = $('open-app').disabled
    ? 'Preview unavailable or another checkpoint is being prepared.'
    : 'Replay this checkpoint in a fresh isolated real app. Not a database clone.'
  history.replaceState(null, '', `#${encodeURIComponent(frame.id)}`)
  $('single-link').href = `/ux-review/index.html${location.search}#${encodeURIComponent(frame.id)}`
  save(`gambit-visual-qa-resume-${state.manifest.suite}`, frame.id)
  for (const item of state.cards) {
    item.card.classList.toggle('selected', item.frame.id === frame.id)
    item.card.classList.toggle('inspecting', state.inspecting && item.frame.id === frame.id)
  }
  progress()
  showRef()
  if (state.manifest) playgroundStatus()
  schedulePreviews()
}

function bindInspection(iframe, frame) {
  const doc = iframe.contentDocument
  if (!doc) return
  doc.addEventListener(
    'click',
    async event => {
      event.preventDefault()
      event.stopPropagation()
      if (!state.inspecting || state.selected?.id !== frame.id) return
      const element = event.target.closest?.('[data-review-id]')
      if (!element) return
      const live = frame.livePreviewUrl && (!state.pixels || !frame.captured)
      if (live) {
        const rect = element.getBoundingClientRect()
        state.element = { id: element.dataset.reviewId, tag: element.tagName.toLowerCase(), role: element.getAttribute('role'), text: element.textContent.slice(0, 240), accessibleName: element.getAttribute('aria-label') || element.textContent.slice(0, 240), rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height} }
      } else {
      if (!state.elements.has(frame.id)) {
        const response = await fetch('/' + frame.domSnapshot.elementsPath)
        if (!response.ok) {
          warn('Element index could not be loaded.')
          return
        }
        state.elements.set(frame.id, (await response.json()).elements)
      }
      state.element = state.elements
        .get(frame.id)
        .find(item => item.id === element.dataset.reviewId)
      }
      doc.querySelectorAll('[data-inspection-selected]').forEach(node => {
        node.style.outline = ''
        node.removeAttribute('data-inspection-selected')
      })
      element.style.outline = '2px solid #ff9030'
      element.setAttribute('data-inspection-selected', '')
      showRef()
    },
    true
  )
}

let observer
function render() {
  observer?.disconnect()
  clearTimeout(state.dwell)
  state.centreFrame = null
  $('cards').replaceChildren()
  $('connections').replaceChildren()
  $('journey-list').replaceChildren()
  state.cards = []
  const visible = state.groups.filter(group =>
    group.frames.some(frame => widths().includes(frame.viewport) && matches(frame))
  )
  const rowHeight = Math.max(0, ...visible.map(group =>
    group.frames
      .filter(frame => widths().includes(frame.viewport) && matches(frame))
      .reduce((height, frame) => height + screenHeight(frame) + 26, 0)
  )) + 80
  // Compact rows after filtering while retaining the explicitly authored branches.
  const rowIds = [...new Set(visible.map(group => group.row))].sort((a, b) => a - b)
  const rowMap = new Map(rowIds.map((row, index) => [row, index]))
  const positions = new Map()
  const headings = new Set()
  for (const group of visible) {
    const x = group.column * 710
    const y = rowMap.get(group.row) * rowHeight + 70
    positions.set(group.key, { x, y })
    if (!headings.has(group.journey)) {
      headings.add(group.journey)
      const heading = document.createElement('div')
      heading.className = 'journey-heading'
      heading.textContent = group.journey
      heading.style.left = '0px'
      heading.style.top = `${y - 55}px`
      $('cards').append(heading)
      const jump = document.createElement('button')
      jump.textContent = group.journey
      jump.addEventListener('click', () => {
        const item = state.cards.find(item => item.group.key === group.key)
        if (item) focus(item.frame)
      })
      $('journey-list').append(jump)
    }
    let offset = 0
    for (const width of widths()) {
      const frame = group.frames.find(frame => frame.viewport === width)
      if (!frame || !matches(frame)) continue
      const scale = previewScale(frame)
      const w = frame.width * scale
      const h = screenHeight(frame)
      const card = document.createElement('article')
      card.className = 'screen'
      card.dataset.frame = frame.id
      card.style.cssText = `left:${x}px;top:${y + offset}px;--screen-width:${w + 4}px;--screen-height:${h}px;--native-width:${frame.width}px;--native-height:${frame.height}px;--preview-scale:${scale}`
      const head = document.createElement('div')
      head.className = 'screen-head'
      const label = document.createElement('p')
      label.textContent = `${frame.checkpointLabel || group.step} · ${frame.stateLabel || ''} · ${frame.viewportLabel}`
      label.title = `${label.textContent}\n${frame.requestText || frame.fixtureBasis || frame.description}`
      const status = document.createElement('span')
      status.className = 'screen-status'
      const request = document.createElement('p')
      request.className = 'screen-request'
      request.textContent = frame.requestText || frame.fixtureBasis || frame.stateLabel
      request.title = request.textContent
      head.append(label, status, request)
      const body = document.createElement('div')
      body.className = 'screen-body'
      const live = frame.livePreviewUrl && (!state.pixels || !frame.captured)
      const iframe = live || frame.domSnapshot && !state.pixels ? document.createElement('iframe') : null
      if (iframe) {
        const placeholder = document.createElement('p')
        placeholder.textContent = 'Zoom in to preview'
        placeholder.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;margin:0;color:#6b7280;font:14px sans-serif'
        body.append(placeholder)
        iframe.title = `${frame.scenarioTitle}, ${frame.stepId}, ${frame.viewportLabel}`
        iframe.setAttribute('sandbox', live ? 'allow-scripts allow-same-origin' : 'allow-same-origin')
        iframe.addEventListener('load', () => {
          if (!iframe.getAttribute('src')) return
          if (!live && !iframe.contentDocument?.querySelector('[data-review-id]')) return
          card.dataset.loaded = 'true'
          placeholder.hidden = true
          placeholder.style.display = 'none'
          bindInspection(iframe, frame)
          scheduleCentre()
        })
        iframe.hidden = true
      } else {
        const image = document.createElement('img')
        image.alt = frame.scenarioTitle
        image.src = '/' + frame.imagePath
        image.addEventListener('load', () => {
          card.dataset.loaded = 'true'
          scheduleCentre()
        })
        body.append(image)
      }
      card.append(head, body)
      card.addEventListener('click', () => select(frame))
      card.addEventListener('dblclick', () => focus(frame))
      $('cards').append(card)
      state.cards.push({ card, frame, group, iframe, visible: false, x, y: y + offset, w: w + 4, h })
      offset += h + 26
    }
  }
  for (const group of visible)
    for (const edge of group.edges) {
      const from = positions.get(group.key),
        to = positions.get(edge.to)
      if (!from || !to) continue
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('class', 'edge')
      const x1 = from.x + 590,
        y1 = from.y + 170,
        x2 = to.x - 12,
        y2 = to.y + 170
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + 65} ${y1}, ${x2 - 65} ${y2}, ${x2} ${y2}`)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
      text.setAttribute('class', 'edge-label')
      text.setAttribute('x', String(Math.min(x1, x2) + 10))
      text.setAttribute('y', String((y1 + y2) / 2 - 25))
      text.setAttribute('width', String(Math.max(20, Math.abs(x2 - x1) - 20)))
      text.setAttribute('height', '24')
      const label = document.createElementNS('http://www.w3.org/1999/xhtml', 'span')
      label.setAttribute('class', 'edge-label-text')
      label.setAttribute('tabindex', '0')
      label.setAttribute('aria-describedby', edgeTooltip.id)
      label.textContent = edge.label
      label.addEventListener('pointerenter', () => showEdgeTooltip(label))
      label.addEventListener('pointerleave', hideEdgeTooltip)
      label.addEventListener('focus', () => showEdgeTooltip(label))
      label.addEventListener('blur', hideEdgeTooltip)
      text.append(label)
      $('connections').append(path, text)
    }
  observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        const item = state.cards.find(item => item.card === entry.target)
        if (!item?.iframe) continue
        item.visible = entry.isIntersecting
      }
      schedulePreviews()
    },
    { root: $('canvas'), rootMargin: '400px' }
  )
  state.cards.forEach(item => observer.observe(item.card))
  $('empty').hidden = Boolean(state.cards.length)
  if (state.selected && state.cards.some(item => item.frame.id === state.selected.id))
    select(state.selected)
  else if (state.cards.length) select(state.cards[0].frame)
  else {
    state.selected = null
    $('selected-title').textContent = 'No matching screens'
    $('selected-brief').textContent = ''
    $('selected-context').hidden = true
    showRef()
  }
  progress()
  transform()
}

let previewTimer
function schedulePreviews() {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    const centreX = $('canvas').clientWidth / 2
    const centreY = $('canvas').clientHeight / 2
    const distance = item => Math.hypot(
      state.x + (item.x + item.w / 2) * state.zoom - centreX,
      state.y + (item.y + item.h / 2) * state.zoom - centreY
    )
    // A fit-to-all overview can expose hundreds of frames. Keep full app
    // instances bounded and load nearby screens only when readable.
    const candidates = state.cards.filter(item => item.iframe &&
      (item.frame.id === state.selected?.id || item.visible && item.w * state.zoom >= 160))
    candidates.sort((a, b) =>
      Number(b.frame.id === state.selected?.id) - Number(a.frame.id === state.selected?.id) ||
      distance(a) - distance(b))
    const loaded = new Set(candidates.slice(0, 8))
    for (const item of state.cards) {
      if (!item.iframe) continue
      const placeholder = item.card.querySelector('.screen-body p')
      if (loaded.has(item)) {
        if (!item.iframe.isConnected)
          item.card.querySelector('.screen-body').append(item.iframe)
        item.iframe.hidden = false
        if (!item.iframe.getAttribute('src'))
          item.iframe.src = item.frame.livePreviewUrl && (!state.pixels || !item.frame.captured)
            ? item.frame.livePreviewUrl : '/' + item.frame.domSnapshot.htmlPath
      } else {
        item.iframe.hidden = true
        item.iframe.remove()
        if (item.iframe.getAttribute('src')) item.iframe.removeAttribute('src')
        delete item.card.dataset.loaded
        if (placeholder) {
          placeholder.hidden = false
          placeholder.style.display = 'grid'
        }
      }
    }
  }, 80)
}

function transform() {
  hideEdgeTooltip()
  $('world').style.transform = `translate(${state.x}px,${state.y}px) scale(${state.zoom})`
  // Grow gently with zoom, keeping the visible label between 8 and 12px.
  const labelSize = Math.max(8, Math.min(12, 10 * Math.sqrt(state.zoom)))
  $('world').style.setProperty('--edge-label-font-size', `${labelSize / state.zoom}px`)
  $('world').style.setProperty('--edge-label-max-width', `${160 / state.zoom}px`)
  $('zoom').textContent = `${Math.round(state.zoom * 100)}%`
  scheduleCentre()
  schedulePreviews()
}
function zoomTo(value, cx = $('canvas').clientWidth / 2, cy = $('canvas').clientHeight / 2) {
  state.overview = false
  const next = Math.max(0.06, Math.min(4, value))
  state.x = cx - ((cx - state.x) * next) / state.zoom
  state.y = cy - ((cy - state.y) * next) / state.zoom
  state.zoom = next
  transform()
}
function focus(frame) {
  state.overview = false
  const item = state.cards.find(item => item.frame.id === frame.id)
  if (!item) return
  select(frame)
  state.zoom = Math.min(
    2.5,
    ($('canvas').clientWidth - 80) / item.w,
    ($('canvas').clientHeight - 60) / item.h
  )
  state.x = ($('canvas').clientWidth - item.w * state.zoom) / 2 - item.x * state.zoom
  state.y = ($('canvas').clientHeight - item.h * state.zoom) / 2 - item.y * state.zoom
  transform()
  $('canvas').focus({ preventScroll: true })
}
function centreHit() {
  if (
    state.overview ||
    state.zoom < 0.55 ||
    !document.hasFocus() ||
    document.visibilityState !== 'visible' ||
    $('settings').open
  )
    return null
  const area = $('canvas').getBoundingClientRect(),
    x = area.left + area.width / 2,
    y = area.top + area.height / 2
  return (
    state.cards.find(item => {
      const box = item.card.querySelector('.screen-body').getBoundingClientRect()
      return (
        state.zoom * (item.frame.width > 600 ? 0.4 : 0.8) >= 0.4 &&
        item.frame.captured && state.pixels &&
        item.card.dataset.loaded &&
        x >= box.left &&
        x <= box.right &&
        y >= box.top &&
        y <= box.bottom
      )
    })?.frame || null
  )
}
function scheduleCentre() {
  const frame = centreHit()
  const key = frame ? seenKey(frame) : null
  if (key === state.centreFrame) return
  clearTimeout(state.dwell)
  state.centreFrame = key
  $('centre').classList.remove('dwell')
  if (!frame || state.seen.has(key)) return
  $('centre').classList.add('dwell')
  state.dwell = setTimeout(() => {
    if (seenKey(centreHit() || {}) !== key) return
    state.seen.add(key)
    save('gambit-visual-qa-seen-v1', [...state.seen])
    $('centre').classList.remove('dwell')
    progress()
    // Keep the card in place until the user changes filters; no layout jump while panning.
  }, 300)
}

let drag
$('canvas').addEventListener('pointerdown', event => {
  const middleButton = event.button === 1
  if (event.button !== 0 && !middleButton) return
  if (!middleButton && event.target.closest('button,iframe,.edge-label-text')) return
  if (middleButton) event.preventDefault()
  drag = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    tx: state.x,
    ty: state.y,
    frame: !middleButton && state.cards.find(item => item.card === event.target.closest('.screen'))?.frame,
  }
  $('canvas').setPointerCapture(event.pointerId)
  $('canvas').classList.add('dragging')
})
$('canvas').addEventListener('pointermove', event => {
  if (!drag || drag.pointerId !== event.pointerId) return
  state.overview = false
  state.x = drag.tx + event.clientX - drag.x
  state.y = drag.ty + event.clientY - drag.y
  transform()
})
$('canvas').addEventListener('pointerup', event => {
  if (!drag || drag.pointerId !== event.pointerId) return
  if (drag?.frame && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5)
    select(drag.frame)
  drag = null
  $('canvas').classList.remove('dragging')
})
$('canvas').addEventListener('pointercancel', () => {
  drag = null
  $('canvas').classList.remove('dragging')
})
$('canvas').addEventListener('lostpointercapture', () => {
  drag = null
  $('canvas').classList.remove('dragging')
})
$('canvas').addEventListener('auxclick', event => {
  if (event.button === 1) event.preventDefault()
})
$('canvas').addEventListener('dblclick', event => {
  const item = state.cards.find(item => {
    const box = item.card.getBoundingClientRect()
    return (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    )
  })
  if (item) focus(item.frame)
})
$('canvas').addEventListener(
  'wheel',
  event => {
    event.preventDefault()
    state.overview = false
    if (event.ctrlKey || event.metaKey) {
      const box = $('canvas').getBoundingClientRect()
      zoomTo(
        state.zoom * Math.exp(-event.deltaY * 0.004),
        event.clientX - box.left,
        event.clientY - box.top
      )
    } else {
      state.x -= event.deltaX
      state.y -= event.deltaY
      transform()
    }
  },
  { passive: false }
)
document.addEventListener('visibilitychange', () => {
  state.centreFrame = null
  scheduleCentre()
})
window.addEventListener('focus', () => {
  state.centreFrame = null
  scheduleCentre()
})
window.addEventListener('blur', () => {
  clearTimeout(state.dwell)
  state.centreFrame = null
  $('centre').classList.remove('dwell')
})
window.addEventListener('resize', scheduleCentre)
$('plus').onclick = () => zoomTo(state.zoom * 1.3)
$('minus').onclick = () => zoomTo(state.zoom / 1.3)
$('fit').onclick = () => {
  state.overview = true
  const maxX = Math.max(1, ...state.cards.map(item => item.x + item.w)),
    maxY = Math.max(1, ...state.cards.map(item => item.y + item.h))
  state.zoom = Math.min(
    ($('canvas').clientWidth - 60) / maxX,
    ($('canvas').clientHeight - 60) / maxY
  )
  state.x = 30
  state.y = 30
  transform()
}
$('focus').onclick = () => state.selected && focus(state.selected)
$('pixels').onclick = () => {
  state.pixels = !state.pixels
  state.inspecting = false
  $('inspect').setAttribute('aria-pressed', 'false')
  $('pixels').setAttribute('aria-pressed', String(state.pixels))
  render()
}
$('outline-toggle').onclick = () => {
  $('outline').hidden = !$('outline').hidden
  $('outline-toggle').setAttribute('aria-expanded', String(!$('outline').hidden))
  scheduleCentre()
}
$('inspect').onclick = () => {
  state.inspecting = !state.inspecting
  $('inspect').setAttribute('aria-pressed', String(state.inspecting))
  if (state.selected) {
    select(state.selected)
    if (state.inspecting) focus(state.selected)
  }
}
$('flag').onclick = () => {
  if (!state.selected) return
  if (state.element) {
    const reference = ref()
    const index = state.elementFlags.findIndex(
      flag => flag.frameId === reference.frameId && flag.element?.id === reference.element.id
    )
    if (index < 0) {
      state.elementFlags.push(reference)
      state.flags.add(state.selected.id)
      save('gambit-visual-qa-flags', [...state.flags])
    } else state.elementFlags.splice(index, 1)
    save('gambit-visual-qa-element-flags-v1', state.elementFlags)
  } else {
    if (state.flags.has(state.selected.id)) state.flags.delete(state.selected.id)
    else state.flags.add(state.selected.id)
    save('gambit-visual-qa-flags', [...state.flags])
  }
  $('flag').textContent = isFlagged(state.selected) ? 'Flagged' : 'Flag'
  progress()
  showRef()
}
$('note').oninput = showRef
$('copy').onclick = async () => {
  showRef()
  try {
    await navigator.clipboard.writeText($('reference').textContent)
    $('copy').textContent = 'Copied'
    setTimeout(() => ($('copy').textContent = 'Copy reference'), 1200)
  } catch {
    warn('Clipboard unavailable. Select and copy the reference below.')
  }
}
for (const button of $('filters').querySelectorAll('button'))
  button.onclick = () => {
    state.filter = button.dataset.filter
    for (const b of $('filters').querySelectorAll('button'))
      b.setAttribute('aria-pressed', String(b === button))
    render()
    if (state.selected) focus(state.selected)
  }
$('keys').onclick = () => {
  for (const input of $('settings').querySelectorAll('input'))
    input.checked = input.value === state.preferences[input.name]
  $('settings').showModal()
  scheduleCentre()
}
$('settings-close').onclick = () => {
  $('settings').close()
  state.centreFrame = null
  scheduleCentre()
}
for (const input of $('settings').querySelectorAll('input'))
  input.onchange = () => {
    state.preferences[input.name] = input.value
    save('gambit-visual-qa-preferences-v1', state.preferences)
    render()
  }
document.addEventListener('keydown', event => {
  if (
    event.target.closest('input,textarea,select') ||
    $('settings').open ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return
  if (event.key === 'f' || event.key === 'F') $('flag').click()
  if (event.key === 'i' || event.key === 'I') $('inspect').click()
  if (event.key === 'Enter') $('focus').click()
  if (!event.key.startsWith('Arrow')) return
  event.preventDefault()
  const candidates = state.cards.map(item => item.frame).filter(matches)
  let target
  if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
    const available = widths().flatMap(width =>
      candidates.filter(
        frame =>
          frame.scenarioId === state.selected?.scenarioId &&
          frame.stepId === state.selected?.stepId &&
          frame.viewport === width
      )
    )
    const index = available.findIndex(frame => frame.id === state.selected?.id)
    target =
      available[(index + (event.key === 'ArrowUp' ? -1 : 1) + available.length) % available.length]
  } else {
    const available =
      state.preferences.navigation === 'paired'
        ? candidates
        : candidates.filter(frame => frame.viewport === state.selected?.viewport)
    const index = available.findIndex(frame => frame.id === state.selected?.id)
    target =
      available[
        (index + (event.key === 'ArrowLeft' ? -1 : 1) + available.length) % available.length
      ]
  }
  if (target) focus(target)
})

function playgroundStatus() {
  state.previewBusy = false
  state.previewEnabled = true
  state.replayableScenarioIds = [...new Set(state.manifest.frames.filter(frame => frame.replayable).map(frame => frame.scenarioId))]
  $('stop').hidden = true
  $('resume').hidden = true
  $('open-app').disabled = !state.selected?.replayable
  $('playground-status').textContent = state.selected?.replayable
    ? 'Open this checkpoint in an isolated Gambit conversation.'
    : 'Authored loading and failure fixtures cannot be opened as conversations.'
}
$('open-app').onclick = () => {
  if (!state.selected?.replayable) return
  window.open(state.selected.previewUrl, '_blank', 'noopener')
  $('playground-status').textContent = 'Opened a fresh Gambit conversation at this checkpoint.'
}

async function initialize() {
  try {
    const response = await fetch('/__ux-review-assets/manifest.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('Collection unavailable')
    state.manifest = await response.json()
    state.groups = journeyModel(state.manifest.frames)
    try {
      const coverage = await (await fetch('/__ux-review-assets/coverage.json')).json()
      $('handoff').textContent =
        coverage.handoffStatus || 'Developer inspection. Not AI visual approval.'
    } catch {
      $('handoff').textContent = 'Developer inspection. Not AI visual approval.'
    }
    let id
    try {
      id = decodeURIComponent(location.hash.slice(1))
    } catch {
      /* Ignore malformed links */
    }
    render()
    const requested = state.manifest.frames.find(frame => frame.id === id)
    if (requested) focus(requested)
    else $('fit').click()
    playgroundStatus()
  } catch (error) {
    $('handoff').textContent = error.message
    $('empty').hidden = false
  }
}
initialize()
