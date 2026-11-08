import { getCurrentScope, nextTick, onScopeDispose } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { agentLocation, sectionOf } from '@/lib/shell/nav'
import { detectMac, isModEvent } from './usePlatform'

// Workspace-wide shortcuts, installed once by AppShell, so they work on
// every signed-in page. Composer keys (Enter, Shift+Enter, Up in an empty
// composer) belong to the composer; they are listed here only for the
// shortcuts dialog.

export const AGENT_SHORTCUTS = Object.freeze([
  { id: 'new-chat', keys: 'mod+shift+o', label: 'New chat', group: 'General' },
  { id: 'search', keys: 'mod+k', label: 'Search chats', group: 'General' },
  { id: 'sidebar', keys: 'mod+b', label: 'Show or hide the sidebar', group: 'General' },
  { id: 'pane', keys: 'mod+\\', label: 'Show or hide the browser pane', group: 'General' },
  { id: 'shortcuts', keys: 'mod+/', label: 'Keyboard shortcuts', group: 'General' },
  // Handled by useHelpShortcut, outside text fields; listed for the dialog.
  { id: 'help', keys: 'shift+?', label: 'Open help', group: 'General' },
  { id: 'escape', keys: 'esc', label: 'Stop the agent, or close what is open', group: 'General' },
  { id: 'send', keys: 'enter', label: 'Send the message', group: 'Composer' },
  { id: 'newline', keys: 'shift+enter', label: 'New line', group: 'Composer' },
  { id: 'send-always', keys: 'mod+enter', label: 'Send, also from a touch keyboard', group: 'Composer' },
  { id: 'edit-last', keys: 'up', label: 'Edit your last message (empty composer)', group: 'Composer' },
])

const CHAT_ROUTES = new Set(['agent-home', 'agent-chat'])
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

function keyIs(event, letter) {
  return event.code === `Key${letter.toUpperCase()}` || String(event.key || '').toLowerCase() === letter
}

/** Which workspace shortcut an event is, or null. */
export function matchShortcut(event, mac = detectMac()) {
  if (!event || event.isComposing || event.keyCode === 229) return null
  if (isModEvent(event, mac)) {
    if (event.shiftKey && keyIs(event, 'o')) return 'new-chat'
    if (!event.shiftKey && keyIs(event, 'k')) return 'search'
    if (!event.shiftKey && keyIs(event, 'b')) return 'sidebar'
    if (event.code === 'Backslash' || event.key === '\\') return 'pane'
    if (event.code === 'Slash' || event.key === '/' || event.key === '?') return 'shortcuts'
    return null
  }
  if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    return 'escape'
  }
  return null
}

// Reka menus, popovers and dialogs handle Escape themselves, and so does
// any other modal dialog (BaseModal is role="dialog" aria-modal="true"):
// while one is open, Escape is its key and never stops a run underneath.
const DIALOG = '[aria-modal="true"], [role="dialog"], [role="alertdialog"]'

function layerOpen() {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector(`[data-dismissable-layer], ${DIALOG}`))
}

function inField(event) {
  const el = event.target
  return Boolean(el && typeof el.closest === 'function' && el.closest(EDITABLE))
}

export function useAgentHotkeys({ target = typeof window !== 'undefined' ? window : null } = {}) {
  const route = useRoute()
  const router = useRouter()
  const ui = useAgentUiStore()
  const app = useAppStore()
  const auth = useAuthStore()
  const mac = detectMac()

  const onAgent = () => sectionOf(route) === 'agent'

  function websiteId() {
    const wid = route.params?.websiteId ?? app.activeWebsite?.id
    return wid === undefined || wid === null || wid === '' ? null : String(wid)
  }

  function newChat() {
    const wid = websiteId()
    if (!wid) return
    if (route.name === 'agent-home' && String(route.params?.websiteId) === wid && !route.query?.agent) {
      ui.focusComposer()
      return
    }
    Promise.resolve(router.push({ name: 'agent-home', params: { websiteId: wid } }))
      .then(() => ui.focusComposer())
      .catch(() => {})
  }

  // Chat search lives in the agent sidebar's Recents. Elsewhere the key opens
  // the agent first (where the header's Agent link goes), then the search,
  // but not from a field: leaving would throw away what is typed there (Ask
  // AI on the board, an unsaved setting), so the key stays the browser's.
  function search(event) {
    if (onAgent()) {
      ui.openSearch()
      return true
    }
    if (inField(event)) return false
    const wid = websiteId()
    if (!wid) return false
    Promise.resolve(router.push(agentLocation(wid, auth.user?.id)))
      .then(() => nextTick())
      .then(() => {
        if (sectionOf(router.currentRoute.value) === 'agent') ui.openSearch()
      })
      .catch(() => {})
    return true
  }

  function togglePane() {
    if (!CHAT_ROUTES.has(String(route.name || ''))) return false
    const pane = useAgentPaneStore()
    if (typeof pane.toggleOpen !== 'function') return false
    pane.toggleOpen()
    return true
  }

  function escape(event) {
    if (layerOpen()) return false
    const el = event.target
    if (el && typeof el.closest === 'function' && el.closest(`aside, [data-ag-escape-ignore], ${DIALOG}`)) return false
    if (!ui.docked && ui.drawerOpen) {
      ui.closeDrawer()
      return true
    }
    if (!CHAT_ROUTES.has(String(route.name || ''))) return false
    // A first message is sent from the new-chat view ('new') while its chat is created.
    const chatId = route.params?.chatId ? String(route.params.chatId) : 'new'
    const agent = useAgentStore()
    const busy = typeof agent.isChatBusy === 'function' ? agent.isChatBusy(chatId) : false
    if (!busy || typeof agent.stop !== 'function') return false
    Promise.resolve(agent.stop(chatId)).catch(() => {})
    ui.announce('Stopping the agent')
    return true
  }

  function onKeydown(event) {
    if (event.defaultPrevented) return
    const id = matchShortcut(event, mac)
    if (!id) return
    let handled = true
    switch (id) {
      case 'new-chat':
        newChat()
        break
      case 'search':
        handled = search(event)
        break
      case 'sidebar':
        // No sidebar outside the agent: the key stays the browser's.
        if (onAgent()) ui.toggleSidebar()
        else handled = false
        break
      case 'pane':
        handled = togglePane()
        break
      case 'shortcuts':
        ui.toggleShortcuts()
        break
      case 'escape':
        handled = escape(event)
        break
      default:
        handled = false
    }
    if (handled) event.preventDefault()
  }

  target?.addEventListener('keydown', onKeydown)
  const stop = () => target?.removeEventListener('keydown', onKeydown)
  if (getCurrentScope()) onScopeDispose(stop)
  return { stop, onKeydown }
}
