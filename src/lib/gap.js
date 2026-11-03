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

export const GAP_ORDER = ['ai_ahead', 'google_ahead', 'strong_both', 'invisible_both', 'even', 'no_data']

export function gapMeta(cls) {
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
 * loaded it separately and SerpAPI returned only a token (`captured` false),
 * or neither mention nor citation was measured (both null). Whether it names
 * or cites the brand is then unknown, not "no".
 */
export function aiOverviewUnread(overview) {
  if (!overview || !overview.shown) return false
  if (overview.captured === false) return true
  return overview.mentions_you == null && overview.cites_you == null
}

/** "+85" / "-62" for a gap value; empty when there is nothing to compare. */
export function gapValue(value) {
  if (value === null || value === undefined) return ''
  return value > 0 ? `+${value}` : String(value)
}
