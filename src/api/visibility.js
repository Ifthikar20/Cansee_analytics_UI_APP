import api from './client'

// AI visibility dashboard (backend apps.llm_ranking): visibility, share of
// voice, sentiment and citations over a period, by engine and by prompt.
// params: {period: '7d'|'30d'|'90d', interval?: 'day'|'week', engine?, prompt_id?}.
// Silent: every caller shows its failures inline.
export default {
    dashboard: (websiteId, params) =>
        api.get(`/llm-ranking/${websiteId}/visibility-dashboard/`, { params, _silentError: true }),
}
