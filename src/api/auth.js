import api from './client'

export default {
    forgotPassword: (data) => api.post('/auth/forgot-password/', data),
    resetPassword: (data) => api.post('/auth/reset-password/', data),
    updateMe: (data) => api.put('/auth/me/', data),
    deleteMe: () => api.delete('/auth/me/'),
    // 200 {terms: {...}}; 400 terms_version_mismatch when `version` is not
    // the current one. Silent: the acceptance modal shows errors inline.
    acceptTerms: (version) => api.post('/auth/terms/accept/', { version }, { _silentError: true }),
}
