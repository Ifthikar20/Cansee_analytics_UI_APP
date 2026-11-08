import api from './client'

// Google Search Console connection, scoped to a website. The OAuth
// consent itself happens via a full-page redirect to the authorize_url
// returned by connectStart; Google redirects back through the backend
// callback, which lands on /settings/connections?gsc=...
export default {
    connectStart: (wid) => api.post(`/search-console/${wid}/connect/`),
    properties: (wid) => api.get(`/search-console/${wid}/properties/`),
    selectProperty: (wid, siteUrl) => api.post(`/search-console/${wid}/property/`, { site_url: siteUrl }),
    disconnect: (wid) => api.delete(`/search-console/${wid}/connection/`),
}
