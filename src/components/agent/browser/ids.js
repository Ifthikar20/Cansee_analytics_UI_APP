// DOM ids for the pane's tablist. Tab ids carry ':' and capture ids, so they
// are reduced to a safe charset.

export const PANE_PANEL_ID = 'ag-pane-panel'

export function tabDomId(tabId) {
  return `ag-tab-${String(tabId || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`
}
