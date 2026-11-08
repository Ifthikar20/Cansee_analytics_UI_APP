/**
 * The ONE place that knows where "Book a demo" goes.
 *
 * Set VITE_DEMO_BOOKING_URL at build time to a scheduling page
 * (Cal.com, Calendly, HubSpot Meetings, Google Calendar booking page).
 * Only absolute https:// URLs are accepted so a bad build variable can
 * never turn the link into a javascript: or http: target.
 *
 * When the variable is unset or invalid, every demo link falls back to a
 * prefilled email to the sales inbox, so no button ever dead-ends.
 *
 * The scheduler opens in a new tab rather than an embedded iframe: the
 * production CSP (frame-src) deliberately blocks third-party frames, and
 * linking out avoids loading a third-party script on our origin.
 */

export const DEMO_SALES_EMAIL = 'sales@cansee.ai'
export const DEMO_EMAIL_SUBJECT = 'Cansee demo request'

/**
 * Return the URL string when it is a well-formed https:// URL, else null.
 * Exported for tests.
 */
export function normalizeBookingUrl(raw) {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** mailto fallback used when no scheduler is configured. */
export function demoMailtoHref(
  email = DEMO_SALES_EMAIL,
  subject = DEMO_EMAIL_SUBJECT,
) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`
}

/**
 * Resolve the demo link for a given raw config value.
 * Returns { href, external } where `external` means "open in a new tab".
 */
export function resolveDemoLink(raw) {
  const booking = normalizeBookingUrl(raw)
  if (booking) return { href: booking, external: true }
  return { href: demoMailtoHref(), external: false }
}

const resolved = resolveDemoLink(import.meta.env.VITE_DEMO_BOOKING_URL)

/** Final href for every "Book a demo" button. */
export const DEMO_BOOKING_HREF = resolved.href

/** True when a real scheduler is configured (link opens in a new tab). */
export const DEMO_BOOKING_EXTERNAL = resolved.external

/**
 * Follow a sales/demo contact target from a click handler. A scheduler
 * URL opens in a new tab so the user keeps their place in the app; a
 * mailto (or anything else) uses the current window as before.
 */
export function openDemoLink(href, win = window) {
  const target = href || demoMailtoHref()
  if (normalizeBookingUrl(target)) {
    win.open(target, '_blank', 'noopener,noreferrer')
  } else {
    win.location.href = target
  }
}
