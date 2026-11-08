// First-visit hints (coachmarks): which one shows, at most one at a time.
//
// A HintCallout registers its hint while its target is on screen and ready
// (register / unregister). The store shows the first registered hint, in
// registry order (lib/help/hints.js), that the user has not seen and whose
// `after` they have. Nothing shows:
//   - without a signed-in user, or during onboarding;
//   - for an organization viewer, who cannot take the actions the tips
//     point at (a caller passes `when: false` for other read-only cases);
//   - while a page suspends hints (a board panel is open) or a dialog,
//     drawer or modal is open (BaseModal, AgDialog, AgConfirmDialog and
//     AgDrawer call holdHints);
//   - once the user chose "Skip tips".
//
// State is per user and per browser (lib/help/hints.js); there is no
// server copy. "Show tips again" in the help drawer calls resetHints().
import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { HINT_KEYS, clearHintState, loadHintState, pickHint, saveHintState } from '@/lib/help/hints'

export const useHintsStore = defineStore('hints', () => {
    const auth = useAuthStore()

    const uid = computed(() => {
        const id = auth.user?.id
        return id === undefined || id === null || id === '' ? null : String(id)
    })

    const seen = ref([])
    const skipped = ref(false)
    // Registered hint keys, in registration order (a key may appear once).
    const waiting = ref([])
    const suspensions = ref([])
    const current = ref(null)

    watch(
        uid,
        (id) => {
            const state = loadHintState(id)
            seen.value = state.seen
            skipped.value = state.skipped
            current.value = null
        },
        { immediate: true },
    )

    const onboarding = computed(() => auth.session?.onboarding?.needs_onboarding === true)
    const viewer = computed(() => auth.orgRole === 'viewer')

    /** Why no hint can show now: '' when one may. */
    const blockedBy = computed(() => {
        if (!uid.value) return 'signed-out'
        if (skipped.value) return 'skipped'
        if (onboarding.value) return 'onboarding'
        if (viewer.value) return 'viewer'
        if (suspensions.value.length) return 'suspended'
        return ''
    })

    // The hint on screen. A hint keeps showing while it still qualifies, so
    // a newly registered one waits its turn.
    const active = computed(() => {
        if (blockedBy.value) return null
        return pickHint({ waiting: waiting.value, seen: seen.value, current: current.value })
    })
    watch(active, (key) => {
        if (key) current.value = key
    })

    function persist() {
        saveHintState(uid.value, { seen: seen.value, skipped: skipped.value })
    }

    function isActive(key) {
        return active.value === key
    }

    function isSeen(key) {
        return seen.value.includes(key)
    }

    function register(key) {
        if (!HINT_KEYS.includes(key) || waiting.value.includes(key)) return
        waiting.value = [...waiting.value, key]
    }

    function unregister(key) {
        waiting.value = waiting.value.filter((k) => k !== key)
        if (current.value === key) current.value = null
    }

    /** "Got it" (or Escape, or a press elsewhere): this hint never shows again. */
    function dismiss(key) {
        if (!HINT_KEYS.includes(key)) return
        if (!seen.value.includes(key)) seen.value = [...seen.value, key]
        if (current.value === key) current.value = null
        persist()
    }

    /** "Skip tips": no hint shows again until reset. */
    function skipAll() {
        skipped.value = true
        current.value = null
        persist()
    }

    /** "Show tips again": every hint can show again, from the first. */
    function reset() {
        seen.value = []
        skipped.value = false
        current.value = null
        clearHintState(uid.value)
    }

    /** Holds every hint while `on` (a panel or dialog covers the page). */
    function suspend(reason, on = true) {
        const has = suspensions.value.includes(reason)
        if (on && !has) suspensions.value = [...suspensions.value, reason]
        else if (!on && has) suspensions.value = suspensions.value.filter((r) => r !== reason)
    }

    return {
        seen,
        skipped,
        waiting,
        active,
        blockedBy,
        isActive,
        isSeen,
        register,
        unregister,
        dismiss,
        skipAll,
        reset,
        suspend,
    }
})

/**
 * For the help drawer's "Show tips again": forgets which tips the signed-in
 * user saw or skipped, so each shows again the next time its target is on
 * screen. Safe to call before Pinia is installed (it then does nothing).
 * Returns true when the tips were reset.
 */
export function resetHints() {
    if (!getActivePinia()) return false
    useHintsStore().reset()
    return true
}

let holdCount = 0

/**
 * For a dialog, drawer or modal: holds every hint while `isOpen()` is true,
 * and releases on unmount, so a coachmark never shows over (or under) an
 * open dialog and is not dismissed by a press inside it. Call it in a
 * component's setup. Does nothing without Pinia (a component test that
 * installs none).
 */
export function holdHints(isOpen) {
    const reason = `dialog-${++holdCount}`
    let held = false
    function set(on) {
        if (on === held || !getActivePinia()) return
        held = on
        useHintsStore().suspend(reason, on)
    }
    watch(() => Boolean(isOpen()), set, { immediate: true })
    onScopeDispose(() => set(false))
}
