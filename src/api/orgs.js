import api from './client'

// Organization management (single active org — the backend resolves
// "current" from the authenticated user; no org id travels in URLs).
export default {
    // The Team and Domains sections show a failed load inline with a retry.
    listMembers: () => api.get('/orgs/current/members/', { _silentError: true }),
    // Mutations render their errors inline in the settings sections —
    // _silentError keeps the global toast interceptor from doubling up.
    changeMemberRole: (memberId, role) => api.patch(`/orgs/current/members/${memberId}/`, { role }, { _silentError: true }),
    removeMember: (memberId) => api.delete(`/orgs/current/members/${memberId}/`, { _silentError: true }),

    listInvitations: () => api.get('/orgs/current/invitations/'),
    createInvitation: (data) => api.post('/orgs/current/invitations/', data, { _silentError: true }),
    revokeInvitation: (id) => api.delete(`/orgs/current/invitations/${id}/`),
    resendInvitation: (id) => api.post(`/orgs/current/invitations/${id}/resend/`),

    listDomains: () => api.get('/orgs/current/domains/', { _silentError: true }),
    claimDomain: (domain) => api.post('/orgs/current/domains/', { domain }, { _silentError: true }),
    verifyDomain: (id) => api.post(`/orgs/current/domains/${id}/verify/`),
    updateDomain: (id, data) => api.patch(`/orgs/current/domains/${id}/`, data, { _silentError: true }),
    removeDomain: (id) => api.delete(`/orgs/current/domains/${id}/`, { _silentError: true }),

    setSsoEnforcement: (enabled) => api.post('/orgs/current/sso/enforce/', { enabled }, { _silentError: true }),

    // Month-to-date seats + per-member prompt/AI usage (admin only) —
    // the numbers custom enterprise billing is based on.
    getUsage: () => api.get('/orgs/current/usage/', { _silentError: true }),

    // Token-addressed invitation flow (public pages).
    previewInvitation: (token) => api.get(`/orgs/invitations/${token}/`, { _silentError: true }),
    acceptInvitation: (token) => api.post(`/orgs/invitations/${token}/accept/`, {}, { _silentError: true }),
    registerViaInvitation: (token, data) => api.post(`/orgs/invitations/${token}/register/`, data, { _silentError: true }),
}
