// What the Analytics board hands its widgets (board_frontend.md 6a). The
// board page provides BOARD_CONTEXT; cards and panels call useBoard() to
// open and close panels and to refetch the shared data sources. The panel
// provides IN_PANEL, so a reused page can tell it renders there.
import { computed, inject } from 'vue'
import { routeLocationKey, routerKey } from 'vue-router'
import { boardLocation } from './links'

export const BOARD_CONTEXT = Symbol('board-context')
export const IN_PANEL = Symbol('board-in-panel')
// BoardWidget's retry, for the card it could not load (CardLoadError).
export const CARD_RETRY = Symbol('board-card-retry')

const BOARD_KEYS = ['websiteId', 'open', 'close', 'invalidate', 'revalidate']

/** True inside the board's side panel. */
export function useInPanel() {
    return inject(IN_PANEL, false)
}

// Outside a board (a page's own spec, a stray mount): follow the route's
// project and navigate to the board; there is no shared cache to refetch.
function detachedBoard() {
    const router = inject(routerKey, null)
    const route = inject(routeLocationKey, null)
    const websiteId = computed(() => {
        const wid = route?.params?.websiteId
        return wid === undefined || wid === null || wid === '' ? null : String(wid)
    })
    function go(location) {
        if (!router) return
        try {
            Promise.resolve(router.push(location)).catch(() => {})
        } catch {
            // No analytics route in this router: nowhere to go.
        }
    }
    return {
        websiteId,
        open: (key, query = {}) => go(boardLocation(websiteId.value, key, query)),
        close: () => go(boardLocation(websiteId.value)),
        invalidate: () => {},
        revalidate: () => {},
    }
}

/**
 * The board's context: {websiteId (computed), open(key, query?), close(),
 * invalidate(sourceKey), revalidate()}. open() never changes the layout.
 */
export function useBoard() {
    const ctx = inject(BOARD_CONTEXT, null)
    if (ctx && BOARD_KEYS.every((key) => key in ctx)) return ctx
    return { ...detachedBoard(), ...(ctx || {}) }
}
