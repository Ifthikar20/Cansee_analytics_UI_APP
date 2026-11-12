// Brand logo helpers.
//
// Brand extraction only yields names, not domains, so we can't always
// resolve a real logo. BrandLogo.vue makes a best-effort guess at the
// brand's domain and, when no logo resolves, shows a deterministic colored
// initial badge built from brandInitial and brandColor.

// Ink and dark warm grays only: the badge carries white text, and no brand
// gets a hue of its own (the product has a single accent).
const BADGE_COLORS = [
  '#0b0b0b', '#2b2a28', '#3a3936', '#4d4c47', '#5f5e58', '#6b6a63',
]

// Strip punctuation/spaces and append .com. Works for the many brands
// whose domain is just their squashed name (pizzahut.com, doordash.com,
// grubhub.com, ubereats.com, papajohns.com, postmates.com). When it
// guesses wrong the image errors and we fall back to the badge.
export function brandDomainGuess(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, 'and')
    .replace(/\b(inc|llc|corp|co|app)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
  return slug ? `${slug}.com` : ''
}

export function brandInitial(name) {
  const m = String(name || '').trim().match(/[a-z0-9]/i)
  return m ? m[0].toUpperCase() : '?'
}

export function brandColor(name) {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return BADGE_COLORS[h % BADGE_COLORS.length]
}
