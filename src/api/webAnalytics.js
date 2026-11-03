import api from './client'

// Where a project's website traffic comes from (Settings > Connections):
// the Cansee pixel (backend apps.websites) and the Google Analytics 4 and
// Cloudflare connections (apps.web_analytics). These endpoints answer
// errors as a bare {"error": "<code or sentence>"}, not the envelope, and a
// 404 from the web-analytics ones means the feature is turned off on the
// server. Silent: the Connections page shows every failure itself.
export default {
    // {pixel_key, snippet}
    pixel: (wid) => api.get(`/websites/${wid}/pixel/`, { _silentError: true }),
    // {verified, pixel_key}: whether the snippet is on the site's home page.
    verifyPixel: (wid) => api.post(`/websites/${wid}/pixel/verify/`, {}, { _silentError: true }),

    // {connected, property_id, property_display_name, pending_property_selection, configured, ...}
    ga4Status: (wid) => api.get(`/web-analytics/ga4/${wid}/status/`, { _silentError: true }),
    // {authorize_url}: Google's consent screen; its callback returns to
    // /settings/connections?ga4=<connected|select_property|error>&website=<id>.
    ga4Connect: (wid) => api.post(`/web-analytics/ga4/${wid}/connect/`, {}, { _silentError: true }),
    // {properties: [{property_id, display_name, account_name}]}
    ga4Properties: (wid) => api.get(`/web-analytics/ga4/${wid}/properties/`, { _silentError: true }),
    // body: {property_id}
    ga4SelectProperty: (wid, body) => api.post(`/web-analytics/ga4/${wid}/property/`, body, { _silentError: true }),
    ga4Disconnect: (wid) => api.delete(`/web-analytics/ga4/${wid}/connection/`, { _silentError: true }),

    // {connected, zone_id, zone_name, pending_zone_selection, zones_found, ...}
    cfStatus: (wid) => api.get(`/web-analytics/cloudflare/${wid}/status/`, { _silentError: true }),
    // body: {api_token}; 400 {error: 'invalid_token'} when Cloudflare refuses it.
    cfConnect: (wid, body) => api.post(`/web-analytics/cloudflare/${wid}/connect/`, body, { _silentError: true }),
    // {zones: [{id, name, status, paused}]}
    cfZones: (wid) => api.get(`/web-analytics/cloudflare/${wid}/zones/`, { _silentError: true }),
    // body: {zone_id}
    cfSelectZone: (wid, body) => api.post(`/web-analytics/cloudflare/${wid}/zone/`, body, { _silentError: true }),
    cfDisconnect: (wid) => api.delete(`/web-analytics/cloudflare/${wid}/connection/`, { _silentError: true }),
}
