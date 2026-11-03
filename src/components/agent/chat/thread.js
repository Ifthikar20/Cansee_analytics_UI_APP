// Read helpers over the agent store for the chat view. They accept the
// store's getters returning either message objects or ids, and never throw
// while the store is still loading.

/** Messages on the visible path of a chat ('new' before it exists). */
export function pathMessages(store, chatKey) {
  if (!store || !chatKey) return []
  let path
  try {
    path = typeof store.visiblePath === 'function' ? store.visiblePath(chatKey) || [] : []
  } catch {
    path = []
  }
  const byId = store.messages || {}
  return path.map((m) => (m && typeof m === 'object' ? m : byId[m])).filter(Boolean)
}

/** {index (1-based), count} for the "‹ 1/2 ›" control. */
export function siblingsOf(store, message) {
  if (!message) return { index: 1, count: 1 }
  let info
  try {
    info = typeof store?.siblingInfo === 'function' ? store.siblingInfo(message.id) : null
  } catch {
    info = null
  }
  if (info && Number.isFinite(info.count)) {
    const position = Number.isFinite(info.position) ? info.position : (Number(info.index) || 0) + 1
    return { index: Math.max(1, position), count: Math.max(1, info.count) }
  }
  const ids = Array.isArray(message.sibling_ids) && message.sibling_ids.length ? message.sibling_ids.map(String) : [String(message.id)]
  const index = ids.indexOf(String(message.id))
  return { index: index >= 0 ? index + 1 : 1, count: ids.length }
}

/** The run record for an assistant message, if the store has one. */
export function runOf(store, message) {
  if (!store || !message) return null
  try {
    if (typeof store.runOf === 'function') return store.runOf(message.id) || null
  } catch {}
  const runs = store.runs || {}
  if (message.run_id && runs[message.run_id]) return runs[message.run_id]
  for (const run of Object.values(runs)) {
    if (run && String(run.messageId) === String(message.id)) return run
  }
  return null
}

export function chatStateOf(store, chatKey) {
  return (store?.chatState && store.chatState[chatKey]) || null
}

export function isBusy(store, chatKey) {
  if (!store || !chatKey) return false
  try {
    return typeof store.isChatBusy === 'function' ? Boolean(store.isChatBusy(chatKey)) : false
  } catch {
    return false
  }
}

export function activeRunOf(store, chatKey) {
  if (!store || !chatKey) return null
  try {
    return typeof store.activeRun === 'function' ? store.activeRun(chatKey) || null : null
  } catch {
    return null
  }
}

/** Plain-text transcript of the visible path, in Markdown. */
export function transcriptMarkdown({ title, project, messages }) {
  const lines = [`# ${title || 'Chat'}`, '']
  if (project) lines.push(`Project: ${project}`, '')
  for (const m of messages || []) {
    const parts = Array.isArray(m.parts) ? m.parts : []
    const text = parts
      .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join('\n\n')
    const calls = parts.filter((p) => p && p.type === 'agent_call' && p.status === 'done')
    if (!text && !calls.length) continue
    lines.push(m.role === 'user' ? '## You' : '## Agent', '')
    if (text) lines.push(text, '')
    for (const call of calls) {
      lines.push(`Executed ${call.agent_name || call.agent || 'agent'}${call.title ? `: ${call.title}` : ''}`, '')
    }
  }
  return `${lines.join('\n').trim()}\n`
}
