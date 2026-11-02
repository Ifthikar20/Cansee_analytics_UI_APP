// The AI engines Cansee asks, in display order. One map for every screen.
//
// Keys follow the API's public names (`chatgpt`); engineKey() folds in the
// provider ids older payloads still carry (`gpt4`). Colours are each
// maker's own accent, used for small markers only, never for meaning.
export const ENGINES = [
  { key: 'chatgpt', label: 'ChatGPT', maker: 'OpenAI', color: '#10a37f', liveWeb: false },
  { key: 'claude', label: 'Claude', maker: 'Anthropic', color: '#d97757', liveWeb: false },
  { key: 'gemini', label: 'Gemini', maker: 'Google', color: '#4285f4', liveWeb: false },
  { key: 'grok', label: 'Grok', maker: 'xAI', color: '#8b8b93', liveWeb: false },
  { key: 'perplexity', label: 'Perplexity', maker: 'Perplexity', color: '#20b8cd', liveWeb: true },
]

const ALIASES = { gpt4: 'chatgpt', openai: 'chatgpt', anthropic: 'claude', xai: 'grok' }

export function engineKey(key) {
  const k = String(key || '').toLowerCase()
  return ALIASES[k] || k
}

export function engineMeta(key) {
  const k = engineKey(key)
  return ENGINES.find((e) => e.key === k) || { key: k, label: key || 'Unknown', maker: '', color: '#8b8b93', liveWeb: false }
}
