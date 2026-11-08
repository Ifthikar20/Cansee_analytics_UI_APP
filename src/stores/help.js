import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'
import { faqById } from '@/lib/help/faq'

// The help drawer: whether it is open, its search, and the question to open
// at. Its own store, so the public Support and Docs pages can use it without
// the agent stores. The feedback widget, when the build has one, registers
// how to open it, so the drawer can offer "Send feedback".
export const useHelpStore = defineStore('help', () => {
    const isOpen = ref(false)
    const query = ref('')
    // The question to expand and focus when the drawer opens, or null.
    const focusId = ref(null)
    const feedbackOpener = shallowRef(null)

    /** Open the drawer, optionally at one question (its id). */
    function open({ faqId = null } = {}) {
        focusId.value = faqId && faqById(faqId) ? String(faqId) : null
        if (focusId.value) query.value = ''
        isOpen.value = true
    }

    function close() {
        isOpen.value = false
    }

    function toggle() {
        if (isOpen.value) close()
        else open()
    }

    function setOpen(value) {
        if (value) open()
        else close()
    }

    function setQuery(value) {
        query.value = String(value ?? '')
    }

    /** The question was shown; the next open starts from the top. */
    function clearFocus() {
        focusId.value = null
    }

    /** Register the feedback widget's opener; returns an unregister function. */
    function setFeedbackOpener(fn) {
        const raw = typeof fn === 'function' ? markRaw(fn) : null
        feedbackOpener.value = raw
        return () => {
            if (feedbackOpener.value === raw) feedbackOpener.value = null
        }
    }

    return { isOpen, query, focusId, feedbackOpener, open, close, toggle, setOpen, setQuery, clearFocus, setFeedbackOpener }
})
