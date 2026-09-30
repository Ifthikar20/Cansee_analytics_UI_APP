import api from './client'

// Brand Security is a findings feed with no scan step. Findings are derived
// from the AI answers the audits, prompt runs and chat checks already
// collected — the response auditor runs as each of those completes, so an
// alert exists the moment the answer that caused it does. There is nothing
// for the user to trigger.
export default {
  // Taxonomy ---------------------------------------------------------------
  // The detector catalog (codes, categories, descriptions, recommended
  // actions). Global, not website-scoped; fetched once per session.
  taxonomy: () => api.get('/brand-security/taxonomy/'),

  // Overview ---------------------------------------------------------------
  // Summary tiles: health_score, open counts by severity/category/detector,
  // last-checked timing.
  overview: (websiteId) =>
    api.get(`/brand-security/websites/${websiteId}/overview/`),

  // Findings ---------------------------------------------------------------
  // params: { status, severity: [], issue: [], detector_code: [], source: [],
  //           reference, search, ordering, result, source_prompt }
  alerts: (websiteId, params = {}) =>
    api.get(`/brand-security/websites/${websiteId}/alerts/`, { params }),
  // Findings raised from the audit responses for one library prompt. Used by
  // the prompt detail page so a reader sees the risk attached to the exact
  // answers shown on that page.
  alertsForPrompt: (websiteId, promptId) =>
    api.get(`/brand-security/websites/${websiteId}/alerts/`, {
      params: { source_prompt: promptId },
    }),
  resolveAlert: (alertId) =>
    api.post(`/brand-security/alerts/${alertId}/resolve/`),
  dismissAlert: (alertId) =>
    api.post(`/brand-security/alerts/${alertId}/dismiss/`),

  // Monitoring config -----------------------------------------------------
  config: (websiteId) =>
    api.get(`/brand-security/websites/${websiteId}/config/`),
  saveConfig: (websiteId, payload) =>
    api.put(`/brand-security/websites/${websiteId}/config/`, payload),

  // Brand Pulse agent ------------------------------------------------------
  // Per-website digest agent: {enabled, auto_scan, frequency, last_digest_at,
  // last_scan_queued_at}. PUT accepts any subset of the writable fields.
  pulse: (websiteId) =>
    api.get(`/brand-security/websites/${websiteId}/pulse/`),
  savePulse: (websiteId, payload) =>
    api.put(`/brand-security/websites/${websiteId}/pulse/`, payload),

  // Security perception ---------------------------------------------------
  // What AI assistants say about the brand's security posture, measured by
  // cold probes over the security prompt pack. params: { days } (0 = all).
  perception: (websiteId, params = {}) =>
    api.get(`/brand-security/websites/${websiteId}/perception/`, { params }),
  // Start a probe. payload: { providers: [], custom_prompts: [] } (both optional).
  runProbe: (websiteId, payload = {}) =>
    api.post(`/brand-security/websites/${websiteId}/perception/probe/`, payload),
}
