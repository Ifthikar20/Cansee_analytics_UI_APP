import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'

// Platform facts for shortcuts and touch layouts. Mac (and iPad keyboards)
// use Cmd as the primary modifier; everyone else uses Ctrl.

const MAC_RE = /Mac|iPhone|iPad|iPod/i

export function detectMac(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || ''
  return MAC_RE.test(platform)
}

const KEY_LABELS = {
  mac: { mod: '⌘', ctrl: '⌃', shift: '⇧', alt: '⌥', enter: 'Return', backspace: '⌫' },
  other: { mod: 'Ctrl', ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', enter: 'Enter', backspace: 'Backspace' },
}

const SHARED_LABELS = {
  esc: 'Esc',
  escape: 'Esc',
  up: '↑',
  arrowup: '↑',
  down: '↓',
  arrowdown: '↓',
  left: '←',
  right: '→',
  tab: 'Tab',
  space: 'Space',
  delete: 'Del',
}

/** Split 'mod+shift+o' or ['mod', 'shift', 'o'] into key names. */
export function shortcutKeys(shortcut) {
  if (Array.isArray(shortcut)) return shortcut.map((k) => String(k).trim()).filter(Boolean)
  if (typeof shortcut !== 'string' || !shortcut.trim()) return []
  // A literal '+' key is written 'plus'.
  return shortcut
    .split('+')
    .map((k) => k.trim())
    .filter(Boolean)
}

/** Display labels for each key: ['⌘', '⇧', 'O'] on a Mac, ['Ctrl', 'Shift', 'O'] elsewhere. */
export function shortcutLabels(shortcut, mac = detectMac()) {
  const table = mac ? KEY_LABELS.mac : KEY_LABELS.other
  return shortcutKeys(shortcut).map((key) => {
    const lower = key.toLowerCase()
    if (lower === 'plus') return '+'
    if (table[lower]) return table[lower]
    if (SHARED_LABELS[lower]) return SHARED_LABELS[lower]
    return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1)
  })
}

/** One string for aria-keyshortcuts-style text and titles: "Ctrl+Shift+O" or "⌘⇧O". */
export function formatShortcut(shortcut, mac = detectMac()) {
  const labels = shortcutLabels(shortcut, mac)
  return mac ? labels.join('') : labels.join('+')
}

/** aria-keyshortcuts value ("Control+Shift+O" / "Meta+Shift+O"). */
export function ariaShortcut(shortcut, mac = detectMac()) {
  const map = { mod: mac ? 'Meta' : 'Control', ctrl: 'Control', shift: 'Shift', alt: 'Alt', esc: 'Escape' }
  return shortcutKeys(shortcut)
    .map((key) => {
      const lower = key.toLowerCase()
      if (map[lower]) return map[lower]
      return key.length === 1 ? key.toUpperCase() : key
    })
    .join('+')
}

/** True when the platform's primary modifier (and only that one) is held, ignoring Shift. */
export function isModEvent(event, mac = detectMac()) {
  if (!event) return false
  if (event.altKey) return false
  return mac ? Boolean(event.metaKey && !event.ctrlKey) : Boolean(event.ctrlKey && !event.metaKey)
}

function mediaQuery(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try {
    return window.matchMedia(query)
  } catch {
    return null
  }
}

/**
 * Reactive platform facts. `coarse` follows (pointer: coarse) so touch
 * layouts (16px inputs, always-visible row actions) can switch live.
 */
export function usePlatform() {
  const isMac = detectMac()
  const coarseQuery = mediaQuery('(pointer: coarse)')
  const coarse = ref(Boolean(coarseQuery?.matches))
  const onChange = (event) => {
    coarse.value = Boolean(event.matches)
  }
  coarseQuery?.addEventListener?.('change', onChange)
  if (getCurrentScope()) onScopeDispose(() => coarseQuery?.removeEventListener?.('change', onChange))

  return {
    isMac,
    modLabel: isMac ? '⌘' : 'Ctrl',
    coarse,
    isTouch: computed(() => coarse.value),
    formatShortcut: (shortcut) => formatShortcut(shortcut, isMac),
    shortcutLabels: (shortcut) => shortcutLabels(shortcut, isMac),
    ariaShortcut: (shortcut) => ariaShortcut(shortcut, isMac),
    isModEvent: (event) => isModEvent(event, isMac),
  }
}
