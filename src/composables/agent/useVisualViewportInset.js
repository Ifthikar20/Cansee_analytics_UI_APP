import { getCurrentScope, onScopeDispose, ref } from 'vue'

// Phones shrink the visual viewport for the on-screen keyboard but leave the
// layout viewport alone, so a position:fixed shell would sit under the
// keyboard. While mounted this keeps three variables on <html> (or `target`):
//   --ag-vv-height  visual viewport height
//   --ag-vv-top     its offset from the top of the layout viewport
//   --ag-vv-inset   the part of the layout viewport the keyboard covers
// They are removed while the page is pinch-zoomed (the layout must not follow
// a zoom), when visualViewport is missing, and on unmount.

const VARS = ['--ag-vv-height', '--ag-vv-top', '--ag-vv-inset']

export function useVisualViewportInset({ target = null } = {}) {
  const inset = ref(0)
  const height = ref(null)
  const noop = { inset, height, stop: () => {} }
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop
  const vv = window.visualViewport
  if (!vv || typeof vv.addEventListener !== 'function') return noop
  const el = target || document.documentElement
  let frame = 0

  function clear() {
    VARS.forEach((name) => el.style.removeProperty(name))
    inset.value = 0
    height.value = null
  }

  function apply() {
    frame = 0
    const scale = Number(vv.scale) || 1
    if (Math.abs(scale - 1) > 0.01) {
      clear()
      return
    }
    const h = Math.max(0, Math.round(vv.height))
    const top = Math.max(0, Math.round(vv.offsetTop || 0))
    const covered = Math.max(0, Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0)))
    el.style.setProperty('--ag-vv-height', `${h}px`)
    el.style.setProperty('--ag-vv-top', `${top}px`)
    el.style.setProperty('--ag-vv-inset', `${covered}px`)
    inset.value = covered
    height.value = h
  }

  function schedule() {
    if (frame) return
    frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(apply) : setTimeout(apply, 16)
  }

  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)
  apply()

  let stopped = false
  function stop() {
    if (stopped) return
    stopped = true
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    if (frame) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      else clearTimeout(frame)
      frame = 0
    }
    clear()
  }

  if (getCurrentScope()) onScopeDispose(stop)
  return { inset, height, stop }
}
