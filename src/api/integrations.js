import api from './client'

export default {
    disconnect: (id) => api.delete(`/notifications/integrations/${id}/`),

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
