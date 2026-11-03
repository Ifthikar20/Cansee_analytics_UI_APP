import api from './client'

export default {
    forgotPassword: (data) => api.post('/auth/forgot-password/', data),
    resetPassword: (data) => api.post('/auth/reset-password/', data),
    updateMe: (data) => api.put('/auth/me/', data),
    deleteMe: () => api.delete('/auth/me/'),
}
