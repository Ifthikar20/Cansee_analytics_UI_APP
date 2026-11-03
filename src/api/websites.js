import api from './client'

export default {
    list: (config) => api.get('/websites/', config),
    delete: (id) => api.delete(`/websites/${id}/`),
}
