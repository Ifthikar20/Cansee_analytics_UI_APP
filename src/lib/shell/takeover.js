import { inject, onBeforeUnmount, watch } from 'vue'

/**
 * A page that covers the whole screen inside AppShell (first-run onboarding)
 * tells the shell so, and the shell makes its header and skip link inert:
 * hidden controls behind a full-screen page must not take focus or be read
 * out. AppShell provides SHELL_TAKEOVER; outside it the call does nothing.
 */
export const SHELL_TAKEOVER = Symbol('shell-takeover')

export function useShellTakeover(active) {
    const shell = inject(SHELL_TAKEOVER, null)
    if (!shell) return
    const token = {}
    watch(active, (on) => shell.set(token, Boolean(on)), { immediate: true })
    onBeforeUnmount(() => shell.set(token, false))
}
