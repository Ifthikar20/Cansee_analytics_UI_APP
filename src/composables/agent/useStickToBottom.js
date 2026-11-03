import { onScopeDispose, ref, toValue, watch } from 'vue'

// Keeps a scroller pinned to its bottom while content grows, and lets go as
// soon as the user scrolls up (wheel, touch, keys or the scrollbar). Scrolling
// back to the bottom, or calling scrollToBottom(), pins it again. Scroll
// events caused by our own writes are told apart by the position we set.

const NEAR_BOTTOM_PX = 64
const SMOOTH_GRACE_MS = 700
const UP_KEYS = new Set(['ArrowUp', 'PageUp', 'Home'])

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * @param scrollerRef ref or getter of the scrolling element
 * @param contentRef  ref or getter of the element whose height grows (optional)
 * @param options     { threshold?: number }
 */
export function useStickToBottom(scrollerRef, contentRef = null, options = {}) {
  const threshold = options.threshold ?? NEAR_BOTTOM_PX
  const isAtBottom = ref(true)
  const isPinned = ref(true)

  let node = null
  let observer = null
  let expectedTop = null
  let lastTop = 0
  let smoothUntil = 0
  let touchY = null

  function distance(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight
  }

  function measure() {
    if (!node) return
    isAtBottom.value = distance(node) <= threshold
  }

  function jump() {
    if (!node) return
    const top = Math.max(0, node.scrollHeight - node.clientHeight)
    if (Math.abs(node.scrollTop - top) >= 1) {
      expectedTop = top
      node.scrollTop = top
    }
    lastTop = node.scrollTop
    isAtBottom.value = true
  }

  function scrollToBottom({ behavior = 'auto' } = {}) {
    isPinned.value = true
    if (!node) return
    if (behavior === 'smooth' && !prefersReducedMotion() && typeof node.scrollTo === 'function') {
      smoothUntil = now() + SMOOTH_GRACE_MS
      node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
      return
    }
    jump()
  }

  function pin() {
    scrollToBottom()
  }

  function unpin() {
    isPinned.value = false
    smoothUntil = 0
  }

  function onScroll() {
    if (!node) return
    const top = node.scrollTop
    const d = distance(node)
    isAtBottom.value = d <= threshold
    if (expectedTop !== null && Math.abs(top - expectedTop) < 2) {
      expectedTop = null
      lastTop = top
      return
    }
    expectedTop = null
    if (smoothUntil && now() < smoothUntil) {
      if (d <= threshold) smoothUntil = 0
      lastTop = top
      return
    }
    if (top < lastTop - 1 && d > threshold) isPinned.value = false
    else if (d <= threshold) isPinned.value = true
    lastTop = top
  }

  function canScroll() {
    return node && node.scrollHeight > node.clientHeight + 1
  }

  function onWheel(event) {
    if (event.deltaY < 0 && canScroll()) unpin()
  }

  function onTouchStart(event) {
    touchY = event.touches?.[0]?.clientY ?? null
  }

  function onTouchMove(event) {
    const y = event.touches?.[0]?.clientY
    // A finger moving down drags the content down, i.e. scrolls up.
    if (touchY !== null && y !== undefined && y > touchY + 4 && canScroll()) unpin()
  }

  function onKeydown(event) {
    if (UP_KEYS.has(event.key) && canScroll()) unpin()
  }

  function onResize() {
    if (isPinned.value) jump()
    else measure()
  }

  function attach(el) {
    node = el
    if (!node) return
    node.addEventListener('scroll', onScroll, { passive: true })
    node.addEventListener('wheel', onWheel, { passive: true })
    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: true })
    node.addEventListener('keydown', onKeydown)
    lastTop = node.scrollTop
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(onResize)
      observer.observe(node)
      const content = toValue(contentRef)
      if (content) observer.observe(content)
    }
    if (isPinned.value) jump()
    else measure()
  }

  function detach() {
    if (!node) return
    node.removeEventListener('scroll', onScroll)
    node.removeEventListener('wheel', onWheel)
    node.removeEventListener('touchstart', onTouchStart)
    node.removeEventListener('touchmove', onTouchMove)
    node.removeEventListener('keydown', onKeydown)
    observer?.disconnect()
    observer = null
    node = null
  }

  watch(
    [() => toValue(scrollerRef), () => toValue(contentRef)],
    ([el]) => {
      detach()
      attach(el || null)
    },
    { immediate: true, flush: 'post' }
  )

  onScopeDispose(detach)

  return { isAtBottom, isPinned, scrollToBottom, pin, unpin, measure, onContentChange: onResize }
}
