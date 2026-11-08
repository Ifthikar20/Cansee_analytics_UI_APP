import { nextTick, onBeforeUnmount, watch } from 'vue'

/**
 * Focus handling for a hand-built modal dialog (BaseModal, ChatDetailModal):
 *
 * - on open, focus moves into the dialog: an `[autofocus]` control, else the
 *   first form field of the dialog's body (`[data-dialog-body]`, or the whole
 *   dialog), else the dialog itself, so a screen reader announces its name.
 *   A confirm dialog therefore never lands on its destructive button.
 * - Tab and Shift+Tab cycle inside the dialog.
 * - on close, focus returns to what had it before, unless it has already
 *   moved on outside the dialog (an action that opened something else) or
 *   that element is gone or behind an inert region.
 * - Escape calls `onEscape` of the dialog opened last only, and claims the
 *   key (preventDefault) so a panel underneath, such as BoardPanel, does not
 *   close too.
 *
 * `container` is a ref to the dialog element (it needs tabindex="-1" so it
 * can take focus itself); `isOpen` is a ref or getter.
 */

// Open dialogs, oldest first. Escape goes to the last one.
const stack = []

function onDocumentKeydown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return
    const top = stack[stack.length - 1]
    if (!top?.onEscape) return
    event.preventDefault()
    top.onEscape(event)
}

function push(entry) {
    if (!stack.length) document.addEventListener('keydown', onDocumentKeydown)
    stack.push(entry)
}

function pull(entry) {
    const i = stack.indexOf(entry)
    if (i !== -1) stack.splice(i, 1)
    if (!stack.length) document.removeEventListener('keydown', onDocumentKeydown)
}

const TABBABLE = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]',
].join(',')

const FIELD = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'

function reachable(el) {
    if (el.tabIndex < 0) return false
    if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false
    return true
}

export function tabbables(root) {
    if (!root) return []
    return [...root.querySelectorAll(TABBABLE)].filter(reachable)
}

export function useDialogFocus(container, isOpen, { onEscape } = {}) {
    let opener = null
    const entry = { onEscape }

    function onKeydown(event) {
        if (event.key !== 'Tab') return
        const root = container.value
        if (!root) return
        const items = tabbables(root)
        if (!items.length) {
            event.preventDefault()
            root.focus()
            return
        }
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        const inside = root.contains(active)
        if (event.shiftKey && (active === first || active === root || !inside)) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && (active === last || !inside)) {
            event.preventDefault()
            first.focus()
        }
    }

    let bound = null
    function bind(root) {
        if (bound === root) return
        unbind()
        if (root) {
            root.addEventListener('keydown', onKeydown)
            bound = root
        }
    }
    function unbind() {
        bound?.removeEventListener('keydown', onKeydown)
        bound = null
    }

    function focusInitial(root) {
        if (!root || root.contains(document.activeElement)) return
        const body = root.querySelector('[data-dialog-body]') || root
        const target =
            root.querySelector('[autofocus]') ||
            [...body.querySelectorAll(FIELD)].find(reachable) ||
            root
        target.focus()
    }

    function giveFocusBack() {
        pull(entry)
        const back = opener
        opener = null
        const root = bound
        unbind()
        const active = document.activeElement
        const inDialog = !active || active === document.body || Boolean(root?.contains(active))
        if (inDialog && back?.isConnected && !back.closest('[inert]')) back.focus()
    }

    const read = () => (typeof isOpen === 'function' ? isOpen() : isOpen.value)

    watch(
        read,
        async (open, wasOpen) => {
            if (!open) {
                if (wasOpen) giveFocusBack()
                return
            }
            const active = document.activeElement
            opener = active && active !== document.body ? active : null
            pull(entry)
            push(entry)
            await nextTick()
            // Closed again before it rendered: the close already cleaned up.
            if (!read()) return
            const root = container.value
            bind(root)
            focusInitial(root)
        },
        { immediate: true },
    )

    onBeforeUnmount(() => {
        if (bound || stack.includes(entry)) giveFocusBack()
    })
}
