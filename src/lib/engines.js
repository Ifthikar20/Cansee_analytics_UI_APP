// The AI engines Cansee asks, in display order. One map for every screen.
//
// Keys follow the API's public names (`chatgpt`); engineKey() folds in the
// provider ids older payloads still carry (`gpt4`). Colours are each
// maker's own accent, used for small markers only, never for meaning.
export const ENGINES = [
  { key: 'chatgpt', label: 'ChatGPT', maker: 'OpenAI', color: 'var(--viz-cat-1)', liveWeb: false },
  { key: 'claude', label: 'Claude', maker: 'Anthropic', color: 'var(--viz-cat-2)', liveWeb: false },
  { key: 'gemini', label: 'Gemini', maker: 'Google', color: 'var(--viz-cat-3)', liveWeb: false },
  { key: 'grok', label: 'Grok', maker: 'xAI', color: 'var(--viz-cat-4)', liveWeb: false },
  { key: 'perplexity', label: 'Perplexity', maker: 'Perplexity', color: 'var(--viz-cat-5)', liveWeb: true },
]

const ALIASES = { gpt4: 'chatgpt', openai: 'chatgpt', anthropic: 'claude', xai: 'grok' }

function engineKey(key) {
  const k = String(key || '').toLowerCase()
  return ALIASES[k] || k
}

export function engineMeta(key) {
  const k = engineKey(key)
  return ENGINES.find((e) => e.key === k) || { key: k, label: key || 'Unknown', maker: '', color: 'var(--viz-other)', liveWeb: false }
}
