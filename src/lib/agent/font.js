// Inter 4 for the agent workspace. Registered under its own family name so
// the rest of the app keeps the Google Fonts Inter; the latin subset keeps the
// ss02, tnum and zero features the reference uses (slashed zero, tailed l).
import interVariableUrl from 'inter-ui/variable-latin/InterVariable-subset.woff2?url'

export const AGENT_FONT_FAMILY = 'Inter Agent'

let pending = null

/**
 * Register the agent font once per page. Resolves true once the face has
 * loaded, false when the browser has no FontFace API or the file fails; the
 * CSS stack then falls back to Inter from Google Fonts or the system font.
 */
export function ensureAgentFont() {
    if (pending) return pending
    if (typeof document === 'undefined' || typeof FontFace !== 'function' || !document.fonts) {
        pending = Promise.resolve(false)
        return pending
    }
    try {
        const face = new FontFace(AGENT_FONT_FAMILY, `url(${interVariableUrl}) format('woff2')`, {
            weight: '100 900',
            style: 'normal',
            display: 'swap',
        })
        document.fonts.add(face)
        pending = face.load().then(
            () => true,
            () => false,
        )
    } catch {
        pending = Promise.resolve(false)
    }
    return pending
}

/** Test hook: forget the registration so a spec can register again. */
export function _resetAgentFont() {
    pending = null
}
