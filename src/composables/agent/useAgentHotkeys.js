import { getCurrentScope, onScopeDispose } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { useAppStore } from '@/stores/app'
import { detectMac, isModEvent } from './usePlatform'

// Workspace-wide shortcuts, installed once by AgentShell, so they work on
// the Agent and Analytics sides and in Settings. Composer keys (Enter,
// Shift+Enter, Up in an empty composer) belong to the composer; they are
// listed here only for the shortcuts dialog.

export const AGENT_SHORTCUTS = Object.freeze([
  { id: 'new-chat', keys: 'mod+shift+o', label: 'New chat', group: 'General' },
  { id: 'search', keys: 'mod+k', label: 'Search chats', group: 'General' },
  { id: 'sidebar', keys: 'mod+b', label: 'Show or hide the sidebar', group: 'General' },
  { id: 'pane', keys: 'mod+\\', label: 'Show or hide the browser pane', group: 'General' },
  { id: 'shortcuts', keys: 'mod+/', label: 'Keyboard shortcuts', group: 'General' },
  { id: 'escape', keys: 'esc', label: 'Stop the agent, or close what is open', group: 'General' },
  { id: 'send', keys: 'enter', label: 'Send the message', group: 'Composer' },
  { id: 'newline', keys: 'shift+enter', label: 'New line', group: 'Composer' },
  { id: 'send-always', keys: 'mod+enter', label: 'Send, also from a touch keyboard', group: 'Composer' },
  { id: 'edit-last', keys: 'up', label: 'Edit your last message (empty composer)', group: 'Composer' },
])

const CHAT_ROUTES = new Set(['agent-home', 'agent-chat'])

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

// Reka menus, popovers and dialogs handle Escape themselves.
function layerOpen() {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-dismissable-layer]'))
}

export function useAgentHotkeys({ target = typeof window !== 'undefined' ? window : null } = {}) {
  const route = useRoute()
  const router = useRouter()
  const ui = useAgentUiStore()
  const app = useAppStore()
  const mac = detectMac()

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

  // Chat search lives in the Agent side's Recents, so an analytics or
  // settings page first opens the project's agent home.
  function search() {
    const onPage = Boolean(route.meta?.analytics || route.meta?.settings)
    const wid = websiteId()
    if (!onPage || !wid) {
      ui.openSearch()
      return
    }
    Promise.resolve(router.push({ name: 'agent-home', params: { websiteId: wid } }))
      .then(() => ui.openSearch())
      .catch(() => {})
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
    if (el && typeof el.closest === 'function' && el.closest('aside, [data-ag-escape-ignore]')) return false
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
        search()
        break
      case 'sidebar':
        ui.toggleSidebar()
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
