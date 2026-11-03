import api from './client'

// Website traffic and AI traffic (backend apps.web_analytics): real visits
// from the Cansee pixel, Google Analytics 4 or Cloudflare. A source that is
// not connected is a 200 with `empty_reason`, never an error. Country codes
// are uppercase ISO-2 ('GB').
// params: {period: '7d'|'30d'|'90d', source: 'auto'|'pixel'|'ga4'|'cloudflare'}
// (AI traffic takes 'auto'|'pixel'|'ga4').
export default {
    sources: (wid) => api.get(`/web-analytics/${wid}/traffic/sources/`, { _silentError: true }),
    traffic: (wid, params) => api.get(`/web-analytics/${wid}/traffic/`, { params, _silentError: true }),
    countries: (wid, params) => api.get(`/web-analytics/${wid}/traffic/countries/`, { params, _silentError: true }),
    aiTraffic: (wid, params) => api.get(`/web-analytics/${wid}/ai-traffic/`, { params, _silentError: true }),
}
