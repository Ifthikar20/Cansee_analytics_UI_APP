import api from './client'

// REST client for the prompt library. The backend mounts these routes at
// /api/v1/prompt-library/ — see config/urls.py.
export default {
    // ── Per-prompt run schedule (daily/weekly/monthly) ──
    getPromptSchedule: (websiteId, promptId) =>
        api.get(`/prompt-library/websites/${websiteId}/prompts/${promptId}/schedule/`),

    savePromptSchedule: (websiteId, promptId, payload) =>
        api.post(`/prompt-library/websites/${websiteId}/prompts/${promptId}/schedule/`, payload),

    deletePromptSchedule: (websiteId, promptId) =>
        api.delete(`/prompt-library/websites/${websiteId}/prompts/${promptId}/schedule/`),

    // Silent: a logo is decoration; the caller falls back to a badge.
    brandLogo: (domain) =>
        api.get('/prompt-library/logo/', { params: { domain }, _silentError: true }),

    // Per-website archive of a saved prompt (tenant-scoped on the
    // BrandPrompt row). Replaces the old enable/disable, which flipped
    // the shared catalog flag across every tenant.
    setArchived: (brandPromptId, archived) =>
        api.patch(`/prompt-library/brand-prompts/${brandPromptId}/`, { is_archived: archived }),
}
