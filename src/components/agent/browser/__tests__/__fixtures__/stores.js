// Stand-ins for the agent and auth stores in browser pane specs. They expose
// only what the pane reads, so pane specs do not depend on the run pipeline
// or on the API client (which imports the router).
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

export const useAgentStore = defineStore('agent', () => {
  const websiteId = ref('w1')
  const messages = reactive({})
  const paths = reactive({})
  const chatState = reactive({})
  const artifacts = reactive({})
  const loadCalls = []

  function visiblePath(chatId) {
    return (paths[chatId] || []).map((id) => messages[id]).filter(Boolean)
  }

  function artifact(id) {
    return artifacts[id] || null
  }

  async function loadArtifact(id, version) {
    loadCalls.push([id, version ?? null])
    return artifacts[id] || null
  }

  async function loadVersions(id) {
    loadCalls.push([id, 'versions'])
    return artifacts[id]?.versions || []
  }

  return { websiteId, messages, paths, chatState, artifacts, loadCalls, visiblePath, artifact, loadArtifact, loadVersions }
})

export const useAuthStore = defineStore('auth', () => {
  const user = ref({ id: 7 })
  const session = ref(null)
  const accessToken = ref('test-token')
  return { user, session, accessToken }
})

// A Google results page as the contract describes it.
export function serpCapture(overrides = {}) {
  return {
    capture_id: 'c1',
    query: 'best note app',
    page: 2,
    start: 10,
    location: 'us',
    captured_at: '2026-11-02T14:03:00Z',
    brand: { name: 'Turonote', domain: 'turonote.test' },
    brand_positions: [14],
    results: [
      {
        position: 11,
        title: 'The 12 best note taking apps',
        url: 'https://reviews.test/notes',
        display_url: 'https://reviews.test › notes',
        domain: 'reviews.test',
        snippet: 'We compared note apps.',
        is_yours: false,
        is_competitor: false,
      },
      {
        position: 12,
        title: 'Notely: notes for teams',
        url: 'https://notely.test/',
        display_url: 'https://notely.test',
        domain: 'notely.test',
        snippet: 'Write together.',
        is_yours: false,
        is_competitor: true,
        competitor_name: 'Notely',
      },
      {
        position: 14,
        title: 'Turonote: fast notes',
        url: 'https://turonote.test/',
        display_url: 'https://turonote.test',
        domain: 'turonote.test',
        snippet: 'Capture ideas quickly.',
        is_yours: true,
        is_competitor: false,
      },
    ],
    ai_overview: {
      shown: true,
      mentions_you: false,
      cites_you: true,
      references: [{ title: 'Turonote', url: 'https://turonote.test/', domain: 'turonote.test' }],
    },
    people_also_ask: ['What is the best free note app?'],
    error: null,
    ...overrides,
  }
}
