import { ref } from 'vue'
import { canFrameLive, hostOf } from '@/lib/agent/url'

// Live versus reader for page and url tabs.

// Set once the app's own CSP refuses a frame; every page then opens in the
// reader view instead of a blank frame.
export const framesBlocked = ref(false)

export function pageData(tab) {
  const data = (tab && tab.data) || {}
  return {
    ...data,
    url: data.url || (tab && tab.url) || '',
    final_url: data.final_url || (tab && tab.finalUrl) || '',
  }
}

export function pageUrl(tab) {
  const data = pageData(tab)
  return data.final_url || data.url || ''
}

export function liveAllowed(tab) {
  if (framesBlocked.value) return false
  return canFrameLive(pageData(tab))
}

export function pageMode(tab) {
  if (!tab || tab.mode === 'reader') return 'reader'
  return liveAllowed(tab) ? 'live' : 'reader'
}

// Why a page cannot be shown live, for the toggle's tooltip.
export function liveUnavailableReason(tab) {
  if (framesBlocked.value) return "This app's security policy blocks live pages."
  const data = pageData(tab)
  const url = data.final_url || data.url
  if (!url) return 'The page has not loaded yet.'
  if (!/^https:/i.test(url)) return 'Only https pages can be shown live.'
  if (data.frameable === false) return `${hostOf(url) || 'This site'} does not allow embedding.`
  if (data.frameable !== true) return 'The page has not been checked for embedding yet.'
  return 'This page cannot be shown live here.'
}

const ERROR_TITLES = {
  blocked_url: "This address can't be opened.",
  fetch_failed: "The page couldn't be loaded.",
  timeout: 'The page took too long to respond.',
  too_large: 'The page is larger than 2 MB, so it was not loaded.',
  not_html: "This address isn't a web page.",
  too_complex: 'The page has too much markup to read here.',
  busy: 'Too many pages are being read right now. Try again in a moment.',
}

export function pageErrorInfo(error) {
  if (!error) return null
  const code = String(error.code || '')
  return {
    code,
    title: ERROR_TITLES[code] || error.message || "The page couldn't be loaded.",
    body: ERROR_TITLES[code] && error.message && error.message !== ERROR_TITLES[code] ? error.message : '',
  }
}
