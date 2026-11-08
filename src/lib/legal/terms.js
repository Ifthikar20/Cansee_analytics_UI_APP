// Terms of Service acceptance gate.
//
// GET /auth/session/ carries
//   terms: {current_version, accepted_version, accepted_at, needs_acceptance}
// and POST /auth/terms/accept/ {version} records acceptance. While
// needs_acceptance is true, signed-in app screens are blocked by a modal
// (TermsAcceptanceModal, mounted in App.vue) until the user accepts or
// signs out. Public pages (/terms, /privacy, landing, blog) and guest pages
// (/login, password reset) stay readable, so the user can read the terms
// the modal links to.

/** True when the session says the current terms still need accepting. */
export function needsTermsAcceptance(session) {
    return session?.terms?.needs_acceptance === true
}

/**
 * Whether the acceptance modal blocks this route.
 *
 * @param {object} opts
 * @param {boolean} opts.isAuthenticated
 * @param {object|null} opts.session  the /auth/session/ payload
 * @param {object|null} opts.route    the current vue-router route
 */
export function shouldBlockForTerms({ isAuthenticated, session, route }) {
    if (!isAuthenticated || !needsTermsAcceptance(session)) return false
    if (!route?.matched?.length) return false
    const meta = route.meta || {}
    // Only signed-in app screens: public and guest pages stay open.
    if (meta.public || meta.guest) return false
    return meta.requiresAuth === true
}

/** The error code POST /auth/terms/accept/ answers when the version is stale. */
export const TERMS_VERSION_MISMATCH = 'terms_version_mismatch'

/** True when an accept request failed because the terms changed meanwhile. */
export function isTermsVersionMismatch(err) {
    return err?.response?.status === 400
        && err?.response?.data?.error?.code === TERMS_VERSION_MISMATCH
}

/** "2026-11-08" -> "November 8, 2026"; anything else is returned as is. */
export function formatTermsVersion(version) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(version || ''))
    if (!m) return version || ''
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
