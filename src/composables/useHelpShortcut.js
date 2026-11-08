import { getCurrentScope, onScopeDispose } from 'vue'
import { useHelpStore } from '@/stores/help'

// Shift+? (the "?" key) opens or closes the help drawer, outside text
// fields. AppShell and the public Support and Docs pages install it. While
// another dialog or menu is open the key is left alone, so help never
// stacks on top of it.

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/** True for a bare "?" key press (Shift+/ on most layouts) outside a field. */
export function isHelpShortcut(event) {
  if (!event || event.defaultPrevented || event.isComposing || event.keyCode === 229) return false
  if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return false
  const el = event.target
  if (el && typeof el.closest === 'function' && el.closest(EDITABLE)) return false
  return true
}

// Another reka layer (dialog, menu, popover) is open, not the help drawer.
function otherLayerOpen() {
  if (typeof document === 'undefined') return false
  return [...document.querySelectorAll('[data-dismissable-layer]')].some((el) => !el.classList.contains('help-drawer'))
}

export function useHelpShortcut({ target = typeof window !== 'undefined' ? window : null } = {}) {
  const help = useHelpStore()

  function onKeydown(event) {
    if (!isHelpShortcut(event)) return
    if (!help.isOpen && otherLayerOpen()) return
    event.preventDefault()
    help.toggle()
  }

  target?.addEventListener('keydown', onKeydown)
  const stop = () => target?.removeEventListener('keydown', onKeydown)
  if (getCurrentScope()) onScopeDispose(stop)
  return { stop, onKeydown }
}
