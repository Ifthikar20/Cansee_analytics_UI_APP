import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { loadActivitySeen, loadUiPrefs, saveActivitySeen, saveUiPrefs } from '@/lib/agent/storage'

// Agent workspace chrome: sidebar and drawer, recents, dialogs, screen reader
// announcements and composer focus. Device preferences (sidebar and recents
// collapsed) persist in cs-agent-ui-v1. Which chats and activity a user has
// seen is that user's: activity last seen persists per user
// (cs-agent-activity-seen-v1:<uid>, removed on logout), and sign-out or
// another user drops both. Everything else lives for the page.

const ANNOUNCE_DEDUPE_MS = 1500
const ANNOUNCE_CLEAR_MS = 8000
const COMPOSER_SELECTOR = '.ag-composer textarea, .ag-composer [contenteditable="true"]'
const COMPOSER_RETRY_MS = 50
const COMPOSER_RETRIES = 30

export const useAgentUiStore = defineStore('agentUi', () => {
    const auth = useAuthStore()
    const prefs = loadUiPrefs()

    // Docked means the sidebar sits in the layout (>= 1024px); below that it
    // is a drawer. The shell keeps this in sync with the viewport.
    const docked = ref(true)
    // False on pages without the workspace sidebar (Analytics, Settings); the
    // shell keeps it in step with the route.
    const sidebarAvailable = ref(true)
    const sidebarCollapsed = ref(prefs.sidebarCollapsed === true)
    const drawerOpen = ref(false)
    const recentsCollapsed = ref(prefs.recentsCollapsed === true)
    const filterOpen = ref(false)
    const shortcutsOpen = ref(false)
    const addProjectOpen = ref(false)
    // Bumped to ask the recents search field to take focus.
    const searchRequest = ref(0)
    // Bumped on every focusComposer() so a composer can watch it.
    const composerFocusRequest = ref(0)
    const unseenChats = ref({})
    const activitySeenAt = ref({})
    const politeAnnouncement = ref({ id: 0, text: '' })
    const assertiveAnnouncement = ref({ id: 0, text: '' })

    const sidebarVisible = computed(
        () => sidebarAvailable.value && (docked.value ? !sidebarCollapsed.value : drawerOpen.value)
    )
    // A page header shows its own sidebar button when the docked sidebar is
    // collapsed or the layout is narrow, and only where there is a sidebar.
    const showSidebarToggle = computed(() => sidebarAvailable.value && (!docked.value || sidebarCollapsed.value))

    /* ── Sidebar and drawer ── */

    function setDocked(value) {
        docked.value = Boolean(value)
        if (docked.value) drawerOpen.value = false
    }

    function setSidebarAvailable(value) {
        sidebarAvailable.value = Boolean(value)
        if (!sidebarAvailable.value) drawerOpen.value = false
    }

    function setSidebarCollapsed(value) {
        sidebarCollapsed.value = Boolean(value)
        saveUiPrefs({ sidebarCollapsed: sidebarCollapsed.value })
    }

    function setDrawerOpen(value) {
        drawerOpen.value = Boolean(value)
    }

    function openDrawer() {
        drawerOpen.value = true
    }

    function closeDrawer() {
        drawerOpen.value = false
    }

    function toggleSidebar() {
        if (!sidebarAvailable.value) return
        if (docked.value) setSidebarCollapsed(!sidebarCollapsed.value)
        else drawerOpen.value = !drawerOpen.value
    }

    function openSidebar() {
        if (!sidebarAvailable.value) return
        if (docked.value) {
            if (sidebarCollapsed.value) setSidebarCollapsed(false)
        } else {
            drawerOpen.value = true
        }
    }

    /* ── Recents ── */

    function setRecentsCollapsed(value) {
        recentsCollapsed.value = Boolean(value)
        saveUiPrefs({ recentsCollapsed: recentsCollapsed.value })
    }

    function toggleRecents() {
        setRecentsCollapsed(!recentsCollapsed.value)
    }

    function setFilterOpen(value) {
        filterOpen.value = Boolean(value)
    }

    function toggleFilter() {
        filterOpen.value = !filterOpen.value
    }

    /** Ctrl/Cmd+K: reveal the sidebar and focus the chat search field. */
    function openSearch() {
        if (!sidebarAvailable.value) return
        openSidebar()
        if (recentsCollapsed.value) setRecentsCollapsed(false)
        filterOpen.value = true
        searchRequest.value += 1
    }

    function markUnseen(chatId) {
        if (chatId === null || chatId === undefined || chatId === '') return
        unseenChats.value = { ...unseenChats.value, [String(chatId)]: true }
    }

    function markSeen(chatId) {
        const key = String(chatId)
        if (!unseenChats.value[key]) return
        const next = { ...unseenChats.value }
        delete next[key]
        unseenChats.value = next
    }

    function isUnseen(chatId) {
        return Boolean(unseenChats.value[String(chatId)])
    }

    /* ── Activity ── */

    function currentUserId() {
        const id = auth.user?.id
        return id === null || id === undefined || id === '' ? null : String(id)
    }

    function activitySeenAtFor(websiteId) {
        return activitySeenAt.value[String(websiteId)] || null
    }

    function markActivitySeen(websiteId, at) {
        if (websiteId === null || websiteId === undefined || !at) return
        const key = String(websiteId)
        const prev = activitySeenAt.value[key]
        if (prev && Date.parse(prev) >= Date.parse(at)) return
        activitySeenAt.value = { ...activitySeenAt.value, [key]: at }
        saveActivitySeen(currentUserId(), activitySeenAt.value)
    }

    /* ── Dialogs ── */

    function setShortcutsOpen(value) {
        shortcutsOpen.value = Boolean(value)
    }

    function openShortcuts() {
        shortcutsOpen.value = true
    }

    function closeShortcuts() {
        shortcutsOpen.value = false
    }

    function toggleShortcuts() {
        shortcutsOpen.value = !shortcutsOpen.value
    }

    function openAddProject() {
        addProjectOpen.value = true
    }

    function setAddProjectOpen(value) {
        addProjectOpen.value = Boolean(value)
    }

    /* ── Screen reader announcements ── */

    let lastAnnounced = { text: '', politeness: '', at: 0 }
    const clearTimers = { polite: null, assertive: null }

    /**
     * Speak `text` through the shell's live regions. `politeness` is 'polite'
     * (default) or 'assertive' (errors). An identical message within 1.5 s is
     * dropped, so two callers reporting the same event speak once.
     */
    function announce(text, politeness = 'polite') {
        const message = String(text ?? '').replace(/\s+/g, ' ').trim()
        if (!message) return false
        const level = politeness === 'assertive' ? 'assertive' : 'polite'
        const now = Date.now()
        if (
            lastAnnounced.text === message &&
            lastAnnounced.politeness === level &&
            now - lastAnnounced.at < ANNOUNCE_DEDUPE_MS
        ) {
            return false
        }
        lastAnnounced = { text: message, politeness: level, at: now }
        const target = level === 'assertive' ? assertiveAnnouncement : politeAnnouncement
        const id = target.value.id + 1
        target.value = { id, text: message }
        clearTimeout(clearTimers[level])
        // Clear stale text so browsing the page later does not re-read it.
        clearTimers[level] = setTimeout(() => {
            if (target.value.id === id) target.value = { id, text: '' }
        }, ANNOUNCE_CLEAR_MS)
        return true
    }

    /* ── Composer focus ── */

    const composerHandlers = new Set()
    let focusAttempt = 0

    /**
     * A composer can register a focus function; the latest registration wins.
     * Returns the unregister function.
     */
    function registerComposer(handler) {
        if (typeof handler !== 'function') return () => {}
        composerHandlers.add(handler)
        return () => composerHandlers.delete(handler)
    }

    function tryFocusComposer() {
        const handlers = [...composerHandlers].reverse()
        for (const handler of handlers) {
            try {
                if (handler() !== false) return true
            } catch {}
        }
        if (typeof document === 'undefined') return false
        const el = document.querySelector(COMPOSER_SELECTOR)
        if (!el || typeof el.focus !== 'function') return false
        try {
            el.focus({ preventScroll: true })
        } catch {
            el.focus()
        }
        return true
    }

    /**
     * Focus the chat composer. When it is not mounted yet (right after a
     * navigation) this retries for about 1.5 s. Resolves true once focused.
     */
    function focusComposer() {
        composerFocusRequest.value += 1
        const attempt = ++focusAttempt
        if (tryFocusComposer()) return Promise.resolve(true)
        return new Promise((resolve) => {
            let tries = 0
            const tick = () => {
                if (attempt !== focusAttempt) return resolve(false)
                if (tryFocusComposer()) return resolve(true)
                tries += 1
                if (tries >= COMPOSER_RETRIES) return resolve(false)
                setTimeout(tick, COMPOSER_RETRY_MS)
            }
            setTimeout(tick, COMPOSER_RETRY_MS)
        })
    }

    /** Sign-out: drop per-session and per-user state; device preferences stay. */
    function reset() {
        drawerOpen.value = false
        filterOpen.value = false
        shortcutsOpen.value = false
        addProjectOpen.value = false
        unseenChats.value = {}
        activitySeenAt.value = {}
        politeAnnouncement.value = { id: politeAnnouncement.value.id, text: '' }
        assertiveAnnouncement.value = { id: assertiveAnnouncement.value.id, text: '' }
        lastAnnounced = { text: '', politeness: '', at: 0 }
    }

    // Sign-out from anywhere in the app (clearAuth drops the token), not
    // only from the header's account menu. Synchronous, so nothing of the old
    // user renders after it.
    watch(
        () => auth.accessToken,
        (token, before) => {
            if (!token && before) reset()
        },
        { flush: 'sync' }
    )
    // Each user reads their own activity watermark; another user also
    // starts with no unseen chats.
    watch(
        currentUserId,
        (uid, before) => {
            if (before && uid !== before) unseenChats.value = {}
            activitySeenAt.value = loadActivitySeen(uid)
        },
        { immediate: true, flush: 'sync' }
    )

    return {
        docked,
        sidebarAvailable,
        sidebarCollapsed,
        drawerOpen,
        recentsCollapsed,
        filterOpen,
        shortcutsOpen,
        addProjectOpen,
        searchRequest,
        composerFocusRequest,
        unseenChats,
        activitySeenAt,
        politeAnnouncement,
        assertiveAnnouncement,
        sidebarVisible,
        showSidebarToggle,
        setDocked,
        setSidebarAvailable,
        setSidebarCollapsed,
        setDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleSidebar,
        openSidebar,
        setRecentsCollapsed,
        toggleRecents,
        setFilterOpen,
        toggleFilter,
        openSearch,
        markUnseen,
        markSeen,
        isUnseen,
        activitySeenAtFor,
        markActivitySeen,
        setShortcutsOpen,
        openShortcuts,
        closeShortcuts,
        toggleShortcuts,
        openAddProject,
        setAddProjectOpen,
        announce,
        registerComposer,
        focusComposer,
        reset,
    }
})
