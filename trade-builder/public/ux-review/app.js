import { mountLivePreview } from './live-preview.js'
import { loadReviewState, observeSeen, saveReviewState, seenKey } from './review-state.js'

const viewportOrder = ['mobile', 'tablet', 'laptop', 'desktop']
const filterOptions = [
  ['all', 'All'],
  ['unseen', 'Unseen'],
  ['affected', 'Affected'],
  ['flagged', 'Flagged'],
]

const state = {
  manifest: null,
  groups: [],
  visibleGroups: [],
  groupIndex: 0,
  viewport: 'desktop',
  filter: 'all',
  search: '',
  gridOpen: false,
  flags: new Set(),
  seen: new Set(),
  preferences: { navigation: 'axes', widths: 'primary' },
}

const elements = Object.fromEntries(
  [
    'app',
    'handoff-status',
    'run-label',
    'search',
    'filters',
    'scenario-nav',
    'breadcrumb',
    'frame-title',
    'frame-description',
    'viewport-switcher',
    'flag-toggle',
    'image-stage',
    'current-image',
    'empty-state',
    'previous-frame',
    'next-frame',
    'grid-toggle',
    'grid-view',
    'grid-title',
    'grid-content',
    'grid-close',
    'help-dialog',
    'help-toggle',
    'help-close',
    'fatal-error',
    'flag-storage-warning',
    'settings-toggle',
    'settings-dialog',
    'settings-close',
    'review-progress',
    'seen-status',
    'coverage-toggle',
    'coverage-dialog',
    'coverage-close',
    'coverage-content',
    'sidebar-toggle',
  ].map(id => [id, document.getElementById(id)])
)

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function makeGroups(frames) {
  const map = new Map()
  for (const frame of frames) {
    const key = `${frame.scenarioId}::${frame.stepId}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        scenarioId: frame.scenarioId,
        scenarioTitle: frame.scenarioTitle,
        scenarioDescription: frame.scenarioDescription,
        stepId: frame.stepId,
        checkpointLabel: frame.checkpointLabel || frame.stepId,
        stepIndex: frame.stepIndex,
        tags: frame.tags,
        frames: [],
      })
    }
    map.get(key).frames.push(frame)
  }
  return [...map.values()].sort((a, b) => {
    const scenario = a.scenarioId.localeCompare(b.scenarioId)
    return scenario || a.stepIndex - b.stepIndex || a.stepId.localeCompare(b.stepId)
  })
}

function currentGroup() {
  return state.visibleGroups[state.groupIndex]
}

function frameFor(group, viewport = state.viewport) {
  return group?.frames.find(frame => frame.viewport === viewport) || group?.frames[0]
}

function primaryFrames(group) {
  const widths =
    state.preferences.widths === 'primary'
      ? ['desktop', 'mobile']
      : ['desktop', 'mobile', 'tablet', 'laptop']
  return widths.flatMap(width => group.frames.filter(frame => frame.viewport === width))
}

function updateProgress() {
  const frames = state.groups.flatMap(primaryFrames)
  const seen = frames.filter(frame => state.seen.has(seenKey(frame))).length
  elements['review-progress'].textContent = `${seen} / ${frames.length} seen`
  elements['review-progress'].title = 'Seen means displayed, not approved or AI-checked.'
  const frame = currentFrame()
  const recording = frame?.recording
  elements['seen-status'].textContent = frame?.livePreviewUrl
    ? recording
      ? recording.current
        ? `Recorded ${new Date(recording.recordedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
        : 'Earlier recording'
      : 'Fixture'
    : frame && state.seen.has(seenKey(frame)) ? 'Seen' : 'Unseen'
  elements['seen-status'].title = recording
    ? `Recorded ${new Date(recording.recordedAt).toLocaleString()}`
    : ''
}

let livePreviewCleanup
let livePreviewId
let gridLivePreviews = []

const scheduleSeen = observeSeen({
  image: elements['current-image'],
  frame: currentFrame,
  eligible: () =>
    !currentFrame()?.livePreviewUrl &&
    !state.gridOpen &&
    !elements['help-dialog'].open &&
    !elements['settings-dialog'].open &&
    !elements['coverage-dialog'].open,
  onSeen: frame => {
    if (state.seen.has(seenKey(frame))) return
    state.seen.add(seenKey(frame))
    const warning = saveReviewState('gambit-visual-qa-seen-v1', [...state.seen])
    if (warning) {
      elements['flag-storage-warning'].textContent = warning
      elements['flag-storage-warning'].hidden = false
    }
    updateProgress()
    // Don't remove the current frame underneath the reviewer in Unseen.
    renderNavigation()
  },
})

function currentFrame() {
  return frameFor(currentGroup())
}

function assetUrl(path, version = state.manifest?.runId) {
  if (!path) return ''
  const absolutePath = path.startsWith('/') ? path : `/${path}`
  return `${absolutePath}?v=${encodeURIComponent(version || 'current')}`
}

function readSavedFlags() {
  try {
    const flags = JSON.parse(localStorage.getItem('gambit-visual-qa-flags') || '[]')
    if (!Array.isArray(flags) || flags.some(flag => typeof flag !== 'string')) {
      throw new Error('Invalid saved flags')
    }
    return new Set(flags)
  } catch {
    elements['flag-storage-warning'].textContent =
      'Saved flags could not be loaded. You can flag frames for this session.'
    elements['flag-storage-warning'].hidden = false
    return new Set()
  }
}

function persistFlags() {
  try {
    localStorage.setItem('gambit-visual-qa-flags', JSON.stringify([...state.flags]))
    elements['flag-storage-warning'].hidden = true
  } catch {
    elements['flag-storage-warning'].textContent =
      'Flags could not be saved. They remain available until this page closes.'
    elements['flag-storage-warning'].hidden = false
  }
}

function applyFilters({ preserveKey = currentGroup()?.key } = {}) {
  state.visibleGroups = state.groups.filter(groupMatchesFilter)

  const preservedIndex = preserveKey
    ? state.visibleGroups.findIndex(group => group.key === preserveKey)
    : -1
  state.groupIndex = Math.max(
    0,
    preservedIndex >= 0
      ? preservedIndex
      : Math.min(state.groupIndex, state.visibleGroups.length - 1)
  )
  if (state.visibleGroups.length) setGroup(state.groupIndex)
  else render()
}

function groupMatchesFilter(group) {
  const search = state.search.trim().toLowerCase()
  const searchable =
    `${group.scenarioId} ${group.scenarioTitle} ${group.stepId} ${group.tags.join(' ')}`.toLowerCase()
  if (search && !searchable.includes(search)) return false
  if (
    state.filter === 'unseen' &&
    !primaryFrames(group).some(frame => !state.seen.has(seenKey(frame)))
  )
    return false
  if (state.filter === 'affected' && !group.frames.some(frame => frame.affected)) return false
  if (state.filter === 'flagged' && !group.frames.some(frame => state.flags.has(frame.id)))
    return false
  return true
}

function setGroup(index, { updateHash = true } = {}) {
  if (!state.visibleGroups.length) return
  state.groupIndex = (index + state.visibleGroups.length) % state.visibleGroups.length
  const group = currentGroup()
  if (state.filter === 'unseen' && state.seen.has(seenKey(frameFor(group)))) {
    const unseen = primaryFrames(group).find(frame => !state.seen.has(seenKey(frame)))
    if (unseen) state.viewport = unseen.viewport
  }
  if (!group.frames.some(frame => frame.viewport === state.viewport)) {
    state.viewport = group.frames[0].viewport
  }
  if (updateHash) history.replaceState(null, '', `#${encodeURIComponent(currentFrame().id)}`)
  document.getElementById('canvas-link').href =
    `/ux-review/canvas.html${location.search}#${encodeURIComponent(currentFrame().id)}`
  saveReviewState(`gambit-visual-qa-resume-${state.manifest.suite}`, currentFrame().id)
  render()
  preloadNeighbors()
}

function moveGroup(delta) {
  const current = currentFrame()
  const candidates = state.groups.flatMap(group => {
    const frames =
      state.preferences.navigation === 'paired'
        ? primaryFrames(group)
        : group.frames.filter(frame => frame.viewport === state.viewport)
    return frames.map(frame => ({ frame, key: group.key, group }))
  })
  const start = candidates.findIndex(candidate => candidate.frame.id === current?.id)
  for (let step = 1; step <= candidates.length; step++) {
    const index =
      ((start < 0 ? (delta > 0 ? -1 : 0) : start) + delta * step + candidates.length) %
      candidates.length
    const target = candidates[index]
    if (!groupMatchesFilter(target.group)) continue
    if (state.filter === 'unseen' && state.seen.has(seenKey(target.frame))) continue
    applyFilters({ preserveKey: target.key })
    const groupIndex = state.visibleGroups.findIndex(group => group.key === target.key)
    if (groupIndex < 0) continue
    state.viewport = target.frame.viewport
    setGroup(groupIndex)
    return
  }
  applyFilters()
}

function moveScenario(delta) {
  const group = currentGroup()
  if (!group) return
  let index = state.groupIndex + delta
  while (index >= 0 && index < state.visibleGroups.length) {
    if (state.visibleGroups[index].scenarioId !== group.scenarioId) {
      const targetScenario = state.visibleGroups[index].scenarioId
      if (delta < 0) {
        while (index > 0 && state.visibleGroups[index - 1].scenarioId === targetScenario) index--
      }
      setGroup(index)
      return
    }
    index += delta
  }
}

function setViewport(viewport) {
  const group = currentGroup()
  if (!group?.frames.some(frame => frame.viewport === viewport)) return
  state.viewport = viewport
  history.replaceState(null, '', `#${encodeURIComponent(currentFrame().id)}`)
  document.getElementById('canvas-link').href =
    `/ux-review/canvas.html${location.search}#${encodeURIComponent(currentFrame().id)}`
  saveReviewState(`gambit-visual-qa-resume-${state.manifest.suite}`, currentFrame().id)
  render()
  scheduleSeen()
  preloadNeighbors()
}

function moveViewport(delta) {
  const order = state.preferences.widths === 'primary' ? ['mobile', 'desktop'] : viewportOrder
  const available = order.filter(viewport =>
    currentGroup()?.frames.some(frame => frame.viewport === viewport)
  )
  const index = Math.max(0, available.indexOf(state.viewport))
  setViewport(available[(index + delta + available.length) % available.length])
}

function toggleFlag() {
  const frame = currentFrame()
  if (!frame) return
  state.flags.has(frame.id) ? state.flags.delete(frame.id) : state.flags.add(frame.id)
  persistFlags()
  if (state.filter === 'flagged') applyFilters({ preserveKey: currentGroup()?.key })
  else render()
}

function toggleGrid(force) {
  state.gridOpen = typeof force === 'boolean' ? force : !state.gridOpen
  elements['grid-view'].hidden = !state.gridOpen
  elements.app.dataset.gridOpen = String(state.gridOpen)
  if (state.gridOpen) renderGrid()
  scheduleSeen()
}

function renderRunIdentity() {
  elements['run-label'].textContent = state.manifest.suite
  elements['run-label'].title = state.manifest.runId
}

function renderFilters() {
  elements.filters.innerHTML = filterOptions
    .map(
      ([value, label]) =>
        `<button class="filter-button ${state.filter === value ? 'active' : ''}" data-filter="${value}" type="button">${label}</button>`
    )
    .join('')
  elements.filters.querySelectorAll('[data-filter]').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter
      applyFilters()
    })
  })
}

function renderNavigation() {
  const scenarios = new Map()
  for (const group of state.visibleGroups) {
    if (!scenarios.has(group.scenarioId)) scenarios.set(group.scenarioId, [])
    scenarios.get(group.scenarioId).push(group)
  }
  elements['scenario-nav'].innerHTML =
    [...scenarios.entries()]
      .map(
        ([, groups]) => `
    <section class="scenario-group">
      <button class="scenario-label" data-group-key="${escapeHtml(groups[0].key)}" type="button">
        <strong>${escapeHtml(groups[0].scenarioTitle)}</strong><span>${groups.length}</span>
      </button>
      <div class="scenario-steps">
        ${groups.map(group => `<button class="step-link ${group.key === currentGroup()?.key ? 'active' : ''} " data-group-key="${escapeHtml(group.key)}" type="button">${escapeHtml(group.checkpointLabel)}<span class="step-seen">${primaryFrames(group).filter(frame => state.seen.has(seenKey(frame))).length}/${primaryFrames(group).length}</span></button>`).join('')}
      </div>
    </section>
  `
      )
      .join('') || '<div class="empty-state">No frames match this filter.</div>'

  elements['scenario-nav'].querySelectorAll('[data-group-key]').forEach(button => {
    button.addEventListener('click', () => {
      const index = state.visibleGroups.findIndex(group => group.key === button.dataset.groupKey)
      if (index >= 0) setGroup(index)
      elements.app.dataset.sidebarOpen = 'false'
      elements['sidebar-toggle'].setAttribute('aria-expanded', 'false')
    })
  })
  elements['scenario-nav'].querySelector('.step-link.active')?.scrollIntoView({ block: 'nearest' })
}

function renderViewportSwitcher(group) {
  elements['viewport-switcher'].innerHTML = viewportOrder
    .map((viewport, index) => {
      const frame = group.frames.find(candidate => candidate.viewport === viewport)
      if (!frame) return ''
      const classes = [
        'viewport-button',
        state.viewport === viewport ? 'active' : '',
        ['tablet', 'laptop'].includes(viewport) ? 'supplementary' : '',
      ]
        .filter(Boolean)
        .join(' ')
      return `<button class="${classes}" data-viewport="${viewport}" type="button" title="${escapeHtml(frame.viewportLabel)} (${index + 1})">${frame.width}</button>`
    })
    .join('')
  elements['viewport-switcher'].querySelectorAll('[data-viewport]').forEach(button => {
    button.addEventListener('click', () => setViewport(button.dataset.viewport))
  })
}

function renderFrame() {
  const group = currentGroup()
  const frame = currentFrame()
  const hasFrame = Boolean(group && frame)
  elements['empty-state'].hidden = hasFrame
  elements['current-image'].hidden = !hasFrame
  if (!frame?.livePreviewUrl || livePreviewId !== frame.id) { livePreviewCleanup?.(); livePreviewCleanup = undefined; livePreviewId = undefined }
  elements['current-image'].style.display = frame?.livePreviewUrl ? 'none' : ''

  if (!hasFrame) {
    elements['frame-title'].textContent = 'No matching frames'
    elements['frame-description'].textContent = 'Change the search or filter to restore the atlas.'
    elements['empty-state'].textContent = 'Nothing matches the current atlas filter.'
    scheduleSeen()
    updateProgress()
    return
  }

  state.viewport = frame.viewport
  elements.breadcrumb.textContent = `${group.scenarioId}  /  ${group.checkpointLabel}  /  ${frame.viewportLabel}`
  elements['frame-title'].textContent = group.scenarioTitle
  elements['frame-description'].textContent = frame.description || group.scenarioDescription
  if (frame.livePreviewUrl) {
    elements['current-image'].removeAttribute('src')
    if (livePreviewId !== frame.id) {
      livePreviewCleanup = mountLivePreview(elements['current-image'].parentElement, frame)
      livePreviewId = frame.id
      elements['image-stage'].scrollTop = 0
    }
  } else {
    const source = assetUrl(frame.imagePath, frame.currentSha256)
    if (elements['current-image'].getAttribute('src') !== source) elements['current-image'].src = source
  }
  elements['current-image'].alt = `${group.scenarioTitle}, ${group.stepId}, ${frame.viewportLabel}`
  elements['flag-toggle'].classList.toggle('active', state.flags.has(frame.id))
  elements['flag-toggle'].textContent = state.flags.has(frame.id) ? 'Flagged' : 'Flag'
  renderViewportSwitcher(group)
  updateProgress()
  scheduleSeen()
}

function renderGrid() {
  gridLivePreviews.forEach(cleanup => cleanup())
  gridLivePreviews = []
  elements['grid-title'].textContent = `${state.visibleGroups.length} frames · ${state.viewport}`
  elements['grid-content'].innerHTML = state.visibleGroups
    .map(group => {
      const frame = frameFor(group)
      return `<button class="grid-card ${group.key === currentGroup()?.key ? 'active' : ''}" data-group-key="${escapeHtml(group.key)}" type="button">
      ${frame.livePreviewUrl ? '<div data-live-thumbnail></div>' : `<img src="${escapeHtml(assetUrl(frame.thumbnailPath || frame.imagePath))}" alt="" loading="lazy" />`}
      <div><strong>${escapeHtml(group.scenarioTitle)}</strong><span>${escapeHtml(group.checkpointLabel)} · ${escapeHtml(frame.viewportLabel)}</span></div>
    </button>`
    })
    .join('')
  elements['grid-content'].querySelectorAll('[data-group-key]').forEach(button => {
    const group = state.visibleGroups.find(group => group.key === button.dataset.groupKey)
    const frame = frameFor(group)
    const thumbnail = button.querySelector('[data-live-thumbnail]')
    if (thumbnail && frame?.livePreviewUrl) gridLivePreviews.push(mountLivePreview(thumbnail, frame, { thumbnail: true }))
    button.addEventListener('click', () => {
      const index = state.visibleGroups.findIndex(group => group.key === button.dataset.groupKey)
      if (index >= 0) setGroup(index)
      toggleGrid(false)
    })
  })
  elements['grid-content'].querySelector('.grid-card.active')?.scrollIntoView({ block: 'center' })
}

function render() {
  renderFilters()
  renderNavigation()
  renderFrame()
  if (state.gridOpen) renderGrid()
}

function preloadNeighbors() {
  for (const delta of [-2, -1, 1, 2]) {
    const group = state.visibleGroups[state.groupIndex + delta]
    const frame = frameFor(group)
    if (frame && !frame.livePreviewUrl) new Image().src = assetUrl(frame.imagePath)
  }
}

function restoreFromHash() {
  let id
  try {
    id =
      decodeURIComponent(location.hash.slice(1)) ||
      JSON.parse(localStorage.getItem(`gambit-visual-qa-resume-${state.manifest.suite}`) || 'null')
  } catch {
    return
  }
  if (!id) return
  const groupIndex = state.visibleGroups.findIndex(group =>
    group.frames.some(frame => frame.id === id)
  )
  if (groupIndex < 0) return
  const frame = state.visibleGroups[groupIndex].frames.find(candidate => candidate.id === id)
  state.groupIndex = groupIndex
  state.viewport = frame.viewport
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof globalThis.HTMLSelectElement ||
    target?.type === 'radio' ||
    target?.isContentEditable
  )
}

function bindEvents() {
  elements['sidebar-toggle'].addEventListener('click', () => {
    const open = elements.app.dataset.sidebarOpen !== 'true'
    elements.app.dataset.sidebarOpen = String(open)
    elements['sidebar-toggle'].setAttribute('aria-expanded', String(open))
  })
  const dialogs = ['settings', 'coverage']
  for (const name of dialogs) {
    elements[`${name}-toggle`].addEventListener('click', () => {
      elements[`${name}-dialog`].showModal()
      scheduleSeen()
    })
    elements[`${name}-close`].addEventListener('click', () => elements[`${name}-dialog`].close())
    elements[`${name}-dialog`].addEventListener('close', scheduleSeen)
  }
  for (const name of ['navigation', 'widths']) {
    const inputs = elements['settings-dialog'].querySelectorAll(`input[name="${name}"]`)
    inputs.forEach(input => {
      input.checked = input.value === state.preferences[name]
      input.addEventListener('change', () => {
        state.preferences[name] = input.value
        const warning = saveReviewState('gambit-visual-qa-preferences-v1', state.preferences)
        if (warning) {
          elements['flag-storage-warning'].textContent = warning
          elements['flag-storage-warning'].hidden = false
        }
        applyFilters()
        updateProgress()
      })
    })
  }
  elements.search.addEventListener('input', event => {
    state.search = event.target.value
    applyFilters()
  })
  elements['previous-frame'].addEventListener('click', () => moveGroup(-1))
  elements['next-frame'].addEventListener('click', () => moveGroup(1))
  elements['flag-toggle'].addEventListener('click', toggleFlag)
  elements['grid-toggle'].addEventListener('click', () => toggleGrid())
  elements['grid-close'].addEventListener('click', () => toggleGrid(false))
  elements['help-toggle'].addEventListener('click', () => elements['help-dialog'].showModal())
  elements['help-close'].addEventListener('click', () => elements['help-dialog'].close())
  elements['help-dialog'].addEventListener('close', scheduleSeen)

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Escape') {
      if (elements['help-dialog'].open) elements['help-dialog'].close()
      else if (state.gridOpen) toggleGrid(false)
      else elements.search.blur()
      return
    }
    if (
      elements['help-dialog'].open ||
      elements['settings-dialog'].open ||
      elements['coverage-dialog'].open ||
      isTypingTarget(event.target)
    )
      return

    if (event.key === 'ArrowLeft') event.shiftKey ? moveScenario(-1) : moveGroup(-1)
    else if (event.key === 'ArrowRight') event.shiftKey ? moveScenario(1) : moveGroup(1)
    else if (event.key === 'ArrowUp') moveViewport(-1)
    else if (event.key === 'ArrowDown') moveViewport(1)
    else if (/^[1-4]$/.test(event.key)) setViewport(viewportOrder[Number(event.key) - 1])
    else if (event.key.toLowerCase() === 'g') toggleGrid()
    else if (event.key.toLowerCase() === 'f') toggleFlag()
    else if (event.key === '/') elements.search.focus()
    else if (event.key === '?') elements['help-dialog'].showModal()
    else if (event.key === 'Home') setGroup(0)
    else if (event.key === 'End') setGroup(state.visibleGroups.length - 1)
    else return

    event.preventDefault()
  })
}

async function initialize() {
  state.flags = readSavedFlags()
  const review = loadReviewState()
  state.seen = review.seen
  state.preferences = review.preferences
  if (review.warning) {
    elements['flag-storage-warning'].textContent = review.warning
    elements['flag-storage-warning'].hidden = false
  }
  try {
    const response = await fetch('/__ux-review-assets/manifest.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`Manifest returned ${response.status}`)
    state.manifest = await response.json()
    const recordings = state.manifest.recordings
    elements['handoff-status'].textContent = recordings
      ? `${recordings.current}/${recordings.total} conversations refreshed · Live UI`
      : 'Recorded conversations · Live UI'
    state.groups = makeGroups(state.manifest.frames)
    state.visibleGroups = [...state.groups]
    state.viewport = state.manifest.viewports.at(-1)?.name || 'desktop'
    restoreFromHash()
    renderRunIdentity()
    bindEvents()
    render()
    preloadNeighbors()
    loadCoverage()
  } catch (error) {
    elements['fatal-error'].hidden = false
    elements['fatal-error'].textContent =
      `Could not open this visual-QA run. ${error instanceof Error ? error.message : String(error)}`
  }
}

async function loadCoverage() {
  try {
    const response = await fetch('/__ux-review-assets/coverage.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('Coverage unavailable')
    const coverage = await response.json()
    elements['coverage-content'].innerHTML = `
      <p>${coverage.screens.length} screen routes. Gaps are missing evidence, not passing checks.</p>
      <p>${escapeHtml(coverage.handoffStatus || 'Developer inspection: visual verification and functional proof may be missing. This is not a human handoff.')}</p>
      <p>Impact: ${escapeHtml(state.manifest.impact?.mode || 'not recorded')}. Shared or unmapped code expands coverage. Covered routes still have explicit gaps below.</p>
      ${(coverage.capabilities || []).map(capability => `<section class="coverage-screen">
        <strong>${escapeHtml(capability.title)}</strong>
        <p>${capability.checks.map(escapeHtml).join(' · ')}</p>
        <p>${capability.scenarioIds.length} scenarios · ${capability.frameCount} viewport views</p>
        ${capability.missingScenarios.length ? `<p class="coverage-gaps">Missing: ${capability.missingScenarios.map(escapeHtml).join(', ')}</p>` : ''}
      </section>`).join('')}
      ${coverage.screens
        .map(
          screen => `<section class="coverage-screen">
        <strong>${escapeHtml(screen.route)}</strong>
        <p>${screen.capturedStates.length ? `Captured: ${screen.capturedStates.map(escapeHtml).join(', ')}` : 'No captures yet.'}</p>
        <p class="coverage-gaps">Missing: ${screen.missingStates.map(escapeHtml).join(', ') || 'No listed state gaps.'}</p>
        <p>${escapeHtml(screen.persona)} · ${escapeHtml(screen.source)}</p>
      </section>`
        )
        .join('')}`
  } catch {
    elements['coverage-content'].textContent =
      'This older run has no coverage inventory. Generate a new capture to see explicit coverage gaps. It is not evidence of whole-app coverage.'
  }
}

initialize()
