// Message tree helpers. A chat is a tree: regenerate adds an assistant
// sibling, edit adds a user sibling, and the visible path runs from the
// root to the chat's current leaf. `childrenOf` maps a parent key (the
// parent message id, or `root:<chatId>` for first messages) to child ids,
// oldest first. The functions mutate only the `childrenOf` object passed in.

export const ROOT_PREFIX = 'root:'

export function rootKey(chatId) {
    return `${ROOT_PREFIX}${chatId}`
}

export function parentKeyOf(message) {
    if (!message) return null
    return message.parent_id ? String(message.parent_id) : rootKey(message.chat_id)
}

/** Messages from the root to `leafId` (inclusive), following parent_id. */
export function pathTo(messagesById, leafId) {
    const path = []
    const seen = new Set()
    let id = leafId === null || leafId === undefined ? null : String(leafId)
    while (id && !seen.has(id)) {
        const message = messagesById[id]
        if (!message) break
        seen.add(id)
        path.push(message)
        id = message.parent_id ? String(message.parent_id) : null
    }
    return path.reverse()
}

/**
 * Merge a server sibling list into a children list: server order first
 * (it is authoritative and oldest first), then local-only ids in their
 * current order.
 */
export function mergeChildren(childrenOf, key, ids) {
    if (!key) return []
    const incoming = (ids || []).map(String)
    const current = childrenOf[key] || []
    const merged = [...incoming]
    for (const id of current) {
        if (!merged.includes(id)) merged.push(id)
    }
    if (!sameList(current, merged)) childrenOf[key] = merged
    return childrenOf[key] || merged
}

export function addChild(childrenOf, key, id) {
    if (!key || id === null || id === undefined) return
    const list = childrenOf[key] || []
    if (!list.includes(String(id))) childrenOf[key] = [...list, String(id)]
}

export function replaceChild(childrenOf, key, oldId, newId) {
    if (!key) return
    const list = childrenOf[key] || []
    const next = []
    for (const id of list) {
        const value = id === String(oldId) ? String(newId) : id
        if (!next.includes(value)) next.push(value)
    }
    if (!next.includes(String(newId))) next.push(String(newId))
    childrenOf[key] = next
}

export function removeChild(childrenOf, key, id) {
    if (!key || !childrenOf[key]) return
    const next = childrenOf[key].filter((x) => x !== String(id))
    if (next.length) childrenOf[key] = next
    else delete childrenOf[key]
}

/**
 * Position of a message among its siblings, for the "‹ 1/2 ›" control.
 * `index` is 0-based; `position` is 1-based for display.
 */
export function siblingInfo(childrenOf, messagesById, id) {
    const message = messagesById[id]
    const fallback = {
        ids: id ? [String(id)] : [],
        index: 0,
        position: 1,
        count: id ? 1 : 0,
        prevId: null,
        nextId: null,
        hasPrev: false,
        hasNext: false,
    }
    if (!message) return fallback
    let ids = childrenOf[parentKeyOf(message)] || []
    if (!ids.includes(message.id)) {
        ids = message.sibling_ids && message.sibling_ids.includes(message.id) ? message.sibling_ids : [message.id]
    }
    const index = ids.indexOf(message.id)
    const prevId = index > 0 ? ids[index - 1] : null
    const nextId = index < ids.length - 1 ? ids[index + 1] : null
    return {
        ids: [...ids],
        index,
        position: index + 1,
        count: ids.length,
        prevId,
        nextId,
        hasPrev: prevId !== null,
        hasNext: nextId !== null,
    }
}

/**
 * The newest leaf under `id`, descending through the newest (last) child at
 * each level. Returns `id` itself when no children are known. This mirrors
 * the server's rule for PATCH {current_leaf_id}.
 */
export function newestLeaf(childrenOf, messagesById, id) {
    let current = id === null || id === undefined ? null : String(id)
    const seen = new Set()
    while (current && !seen.has(current)) {
        seen.add(current)
        const kids = (childrenOf[current] || []).filter((k) => messagesById[k])
        if (!kids.length) return current
        current = kids[kids.length - 1]
    }
    return current
}

/** Ids of every message in the subtree rooted at `id`, including it. */
export function subtreeIds(childrenOf, id) {
    const out = []
    const stack = [String(id)]
    const seen = new Set()
    while (stack.length) {
        const current = stack.pop()
        if (seen.has(current)) continue
        seen.add(current)
        out.push(current)
        for (const kid of childrenOf[current] || []) stack.push(kid)
    }
    return out
}

function sameList(a, b) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
    return true
}
