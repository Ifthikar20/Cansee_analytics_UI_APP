// Countries a prompt can be searched from: ISO 3166-1 alpha-2 codes, matching
// BrandPrompt.location, and '' for Global (no country). Google results and
// the web-search engines both run from this country. The same list as the
// Overview's Add prompts dialog.

export const COUNTRIES = Object.freeze([
  Object.freeze({ code: 'us', label: 'United States' }),
  Object.freeze({ code: 'gb', label: 'United Kingdom' }),
  Object.freeze({ code: 'ca', label: 'Canada' }),
  Object.freeze({ code: 'au', label: 'Australia' }),
  Object.freeze({ code: 'in', label: 'India' }),
  Object.freeze({ code: 'de', label: 'Germany' }),
  Object.freeze({ code: 'fr', label: 'France' }),
  Object.freeze({ code: '', label: 'Global' }),
])

export const DEFAULT_COUNTRY = 'us'

/** The label for a country code ('' is Global); the code itself when unknown. */
export function countryLabel(code) {
  const key = String(code ?? '').trim().toLowerCase()
  const found = COUNTRIES.find((c) => c.code === key)
  return found ? found.label : key.toUpperCase()
}
