import { toValue } from 'vue'

// Enter-to-send that never fires while an input method is composing text
// (Japanese, Chinese, Korean...). Composition is detected three ways because
// browsers disagree: KeyboardEvent.isComposing, keyCode 229, and a short
// window after compositionend (Safari sends the committing Enter after it).
//
//   Enter               send (unless enterSends is false, e.g. touch keyboards)
//   Shift/Alt+Enter     newline
//   Ctrl/Cmd+Enter      send

const COMPOSITION_GRACE_MS = 30

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * @param options { onSubmit(event), enterSends?: ref|getter|boolean }
 * @returns handlers for keydown, compositionstart and compositionend
 */
export function useImeSafeEnter({ onSubmit, enterSends = true } = {}) {
  let composing = false
  let endedAt = -Infinity

  function isComposing(event) {
    if (composing) return true
    if (event?.isComposing) return true
    if (event?.keyCode === 229) return true
    return now() - endedAt < COMPOSITION_GRACE_MS
  }

  function onCompositionstart() {
    composing = true
  }

  function onCompositionend() {
    composing = false
    endedAt = now()
  }

  /** Returns true when the event was handled as a submit. */
  function onKeydown(event) {
    if (event.key !== 'Enter') return false
    if (isComposing(event)) return false
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      onSubmit?.(event)
      return true
    }
    if (event.shiftKey || event.altKey) return false
    if (!toValue(enterSends)) return false
    event.preventDefault()
    onSubmit?.(event)
    return true
  }

  return { onKeydown, onCompositionstart, onCompositionend, isComposing }
}
