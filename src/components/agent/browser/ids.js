// DOM ids for the pane's tablist. Tab ids carry ':' and capture ids, so they
// are reduced to a safe charset.

export const PANE_PANEL_ID = 'ag-pane-panel'

function safe(tabId) {
  return String(tabId || '').replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function tabDomId(tabId) {
  return `ag-tab-${safe(tabId)}`
}

// A page tab's find bar, and the header button that opens it.
export function findBarId(tabId) {
  return `ag-find-${safe(tabId)}`
}

export function findToggleId(tabId) {
  return `ag-find-toggle-${safe(tabId)}`
}
