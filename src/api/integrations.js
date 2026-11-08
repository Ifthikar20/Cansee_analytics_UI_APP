import api from './client'

export default {
    // ── Slack / Discord / Teams connections ──
    // Silent: the Alert channels card renders these errors itself.
    list: () => api.get('/notifications/integrations/', { _silentError: true }),
    // Upsert by platform. external_team_id is never sent here: only a
    // signed /cansee link command can set it (see linkCode).
    save: (data) => api.post('/notifications/integrations/', data, { _silentError: true }),
    disconnect: (id) => api.delete(`/notifications/integrations/${id}/`),

    // One-time code that links a Slack workspace or Discord server to the
    // connection: 201 {code, command: "/cansee link <code>", expires_in}
    // (seconds). Slack and Discord connections only.
    linkCode: (id) => api.post(`/notifications/integrations/${id}/link-code/`, {}, { _silentError: true }),
    // Clearing the workspace id is the only write the API accepts for it.
    unlinkWorkspace: (id) => api.put(`/notifications/integrations/${id}/`, { external_team_id: '' }, { _silentError: true }),

    // ── Text messages (SMS) ──
    // _silentError everywhere: the card renders errors inline (and the
    // status GET must stay quiet on deployments without SMS support).
    smsList: () => api.get('/notifications/sms/', { _silentError: true }),
    smsSubscribe: (phone) => api.post('/notifications/sms/', { phone }, { _silentError: true }),
    smsVerify: (id, code) => api.post(`/notifications/sms/${id}/verify/`, { code }, { _silentError: true }),
    smsResend: (id) => api.post(`/notifications/sms/${id}/resend/`, {}, { _silentError: true }),
    smsUpdate: (id, data) => api.patch(`/notifications/sms/${id}/`, data, { _silentError: true }),
    smsRemove: (id) => api.delete(`/notifications/sms/${id}/`, { _silentError: true }),
}
