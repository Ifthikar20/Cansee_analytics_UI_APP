// Links into the Analytics board (board_contract.md 2). `widget` opens that
// widget's side panel; every other query key belongs to the open panel.
// Without a project the link goes to /dashboard, whose guard picks one.

/**
 * The router location of the board of `websiteId`, with the panel of
 * `widget` open when one is given. `query` holds the panel's own keys
 * (`prompt`, `period`...); `widget` is always set last.
 */
export function boardLocation(websiteId, widget, query = {}) {
    const q = widget ? { ...(query || {}), widget } : { ...(query || {}) }
    if (websiteId === undefined || websiteId === null || websiteId === '') return { name: 'dashboard', query: q }
    return { name: 'analytics', params: { websiteId: String(websiteId) }, query: q }
}
