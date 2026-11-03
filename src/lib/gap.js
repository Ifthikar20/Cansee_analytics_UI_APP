// Display metadata for the search-vs-AI gap. The classes and scores come
// from the API (apps/search_gap/services/scoring.py); this file only
// decides how they read. Colours are theme tokens (assets/tailwind.css).
export const GAP = {
  ai_ahead: {
    label: 'AI ahead',
    color: 'var(--gap-ai)',
    blurb: 'AI engines rank you higher than Google does.',
  },
  google_ahead: {
    label: 'Google ahead',
    color: 'var(--gap-google)',
    blurb: 'Google ranks you higher than the AI engines do.',
  },
  strong_both: {
    label: 'Strong in both',
    color: 'var(--gap-strong)',
    blurb: 'Google and the AI engines both rank you well.',
  },
  invisible_both: {
    label: 'Invisible in both',
    color: 'var(--gap-invisible)',
    blurb: 'Neither Google nor the AI engines surface you.',
  },
  even: {
    label: 'Even',
    color: 'var(--muted-foreground)',
    blurb: 'Google and the AI engines roughly agree.',
  },
  no_data: {
    label: 'Not checked',
    color: 'var(--muted-foreground)',
    blurb: 'Waiting for a Google check or AI answers.',
  },
}

export const GAP_ORDER = ['ai_ahead', 'google_ahead', 'strong_both', 'invisible_both', 'even', 'not_definite', 'no_data']

// Google was read only to some depth (ScraperAPI: the top 10) without
// finding you, so your search score is a range and the gap could fall in
// either of two classes. The API sends class no_data with definite false.
export const NOT_DEFINITE = Object.freeze({
  label: 'Not definite',
  color: 'var(--muted-foreground)',
  blurb: 'Google was read only to the top results and you were not in them, so the gap could fall in either of two classes.',
})

/** The class key to show and filter by: 'not_definite' for a range that spans two classes. */
export function gapKey(gap) {
  if (gap && gap.definite === false && gap.search_score_max && gap.ai_score !== null && gap.ai_score !== undefined) {
    return 'not_definite'
  }
  return gap?.class || 'no_data'
}

/** Label, color and blurb for a gap object, including the not-definite case. */
export function gapDisplay(gap) {
  return gapKey(gap) === 'not_definite' ? NOT_DEFINITE : gapMeta(gap?.class)
}

/** "+40", or "≥ +45" when only a lower bound is known, or '' when neither is. */
export function gapValueText(gap) {
  if (!gap) return ''
  if (gap.value !== null && gap.value !== undefined) return gapValue(gap.value)
  if (gap.value_min !== null && gap.value_min !== undefined) return `≥ ${gapValue(gap.value_min)}`
  return ''
}

export function gapMeta(cls) {
  if (cls === 'not_definite') return NOT_DEFINITE
  return GAP[cls] || GAP.no_data
}

// Short names for the advice kinds (apps/search_gap/services/advice.py),
// for tight spots like the overview grid. The full title names the page.
export const ACTION_LABELS = {
  make_page_rank: 'Get your page ranking on Google',
  earn_links: 'Earn links both sides trust',
  get_cited: 'Get onto the pages AI cites',
  make_quotable: 'Make your page quotable for AI',
  study_competitor: 'Study the competitor that wins',
  create_page: 'Publish a page for this prompt',
  hold: 'Hold the position',
  check_google: 'Check Google',
}

/** "#94", "Not in top 100", "Not checked". */
export function googleLabel(google) {
  if (!google || google.status === 'not_checked') return 'Not checked'
  if (google.status === 'error') return 'Check failed'
  if (!google.position) return `Not in top ${google.depth || 100}`
  return `#${google.position}`
}

/**
 * True when Google showed an AI Overview whose content was never read: Google
 * loaded it separately or the provider sent only a marker for it
 * (`content_captured` false),
 * or neither mention nor citation was measured (both null). Whether it names
 * or cites the brand is then unknown, not "no".
 */
export function aiOverviewUnread(overview) {
  if (!overview || !overview.shown) return false
  if (overview.content_captured === false) return true
  return overview.mentions_you == null && overview.cites_you == null
}

/** "+85" / "-62" for a gap value; empty when there is nothing to compare. */
export function gapValue(value) {
  if (value === null || value === undefined) return ''
  return value > 0 ? `+${value}` : String(value)
}
