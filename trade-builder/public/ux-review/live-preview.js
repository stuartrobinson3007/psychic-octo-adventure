// Current Gambit rendering inside the original reviewer's viewport and controls.
export function mountLivePreview(host, frame, { thumbnail = false } = {}) {
  const shell = document.createElement('div')
  shell.className = 'frame-image'
  shell.dataset.livePreview = ''
  shell.style.cssText = 'grid-area:1/1;overflow:hidden;position:relative;flex:none'
  const iframe = document.createElement('iframe')
  iframe.title = `${frame.scenarioTitle}, ${frame.stepId}, ${frame.viewportLabel}, current UI`
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  iframe.tabIndex = -1
  iframe.style.cssText = `width:${frame.width}px;height:${frame.height}px;border:0;display:block;transform-origin:0 0;pointer-events:none;background:white`
  host.append(shell)
  const resize = () => {
    const style = getComputedStyle(host)
    const availableWidth = host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    if (availableWidth <= 0) return
    // Fit the width and scroll the height, keeping long frames readable.
    const scale = thumbnail ? availableWidth / frame.width : Math.min(1, availableWidth / frame.width)
    if (scale <= 0) return
    shell.style.width = `${frame.width * scale}px`
    shell.style.height = `${thumbnail ? availableWidth * 10 / 16 : frame.height * scale}px`
    iframe.style.transform = `scale(${scale})`
  }
  const sizes = new ResizeObserver(resize)
  sizes.observe(host)
  resize()
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && !iframe.getAttribute('src')) {
        shell.append(iframe)
        iframe.src = frame.livePreviewUrl
      } else if (!entry.isIntersecting) {
        iframe.remove()
        iframe.removeAttribute('src')
      }
    }
  })
  visibility.observe(shell)
  return () => { sizes.disconnect(); visibility.disconnect(); shell.remove() }
}
