import { onScopeDispose, toValue, watch } from 'vue'
import { clearDraft, loadDraft, saveDraft } from '@/lib/agent/storage'

// Per-chat composer drafts (cs-agent-draft-v1:<uid>:<wid>:<cid|new>, see
// lib/agent/storage.js). Switching chat saves the old draft and loads the
// new one; typing saves after a short pause.

function sameScope(a, b) {
  return Boolean(a && b && a.uid === b.uid && a.wid === b.wid && a.cid === b.cid)
}

function usable(scope) {
  return Boolean(scope && scope.uid !== undefined && scope.uid !== null && scope.wid !== undefined && scope.wid !== null)
}

/**
 * @param scope ref/getter returning {uid, wid, cid} (cid null for a new chat),
 *              or null while the user or project is unknown
 * @param text  ref holding the composer text
 */
export function useComposerDraft(scope, text, { delay = 400 } = {}) {
  let timer = 0
  let pending = null

  function write(target, value) {
    if (usable(target)) saveDraft(target.uid, target.wid, target.cid, value)
  }

  function flush() {
    if (timer) clearTimeout(timer)
    timer = 0
    if (pending) write(pending, text.value)
    pending = null
  }

  function clear() {
    if (timer) clearTimeout(timer)
    timer = 0
    pending = null
    const current = toValue(scope)
    if (usable(current)) clearDraft(current.uid, current.wid, current.cid)
  }

  watch(
    () => {
      const s = toValue(scope)
      return usable(s) ? { uid: s.uid, wid: s.wid, cid: s.cid || null } : null
    },
    (next, previous) => {
      if (sameScope(next, previous)) return
      if (previous && sameScope(pending, previous)) flush()
      else {
        if (timer) clearTimeout(timer)
        timer = 0
        pending = null
      }
      text.value = usable(next) ? loadDraft(next.uid, next.wid, next.cid) : ''
    },
    { immediate: true }
  )

  watch(text, () => {
    const current = toValue(scope)
    if (!usable(current)) return
    if (timer) clearTimeout(timer)
    pending = { uid: current.uid, wid: current.wid, cid: current.cid || null }
    timer = setTimeout(flush, delay)
  })

  onScopeDispose(flush)

  return { clear, flush }
}
