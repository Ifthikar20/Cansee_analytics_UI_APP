import api from './client'

export default {
    getCurrent: (config) => api.get('/billing/', config),
    // Public: the pricing window shows it signed out too. Billing, Paywall
    // and Pricing show a failed load inline with a retry.
    getPlans: () => api.get('/billing/plans/', { _silentError: true }),
    // Polar hosted checkout for {plan: 'prompts_100' | 'prompts_200'}.
    // Silent: every page reports the outcome once, in its own words.
    checkout: (data) => api.post('/billing/checkout/', data, { _silentError: true }),
    // Post-redirect verification of a completed Polar checkout.
    confirm: (checkoutId) => api.post('/billing/confirm/', { checkout_id: checkoutId }),
    // "Continue with the free plan" on the paywall — persists the
    // dismissal so next_route stops returning 'paywall'.
    dismissPaywall: () => api.post('/billing/paywall/dismiss/'),
    cancel: () => api.post('/billing/cancel/'),
    resume: () => api.post('/billing/resume/'),
    // End the free trial immediately: card charged now, Pro unlocked now.
    // Optional {annual} switches the cadence in the same call.
    upgradeNow: (data) => api.post('/billing/upgrade-now/', data || {}),
    // {plan} moves an active subscription to the other plan (ChangePlanDialog,
    // silent: it shows the error itself); {annual} switches a legacy Pro row
    // between monthly and annual.
    changePlan: (data, config) => api.post('/billing/change-plan/', data, config),
    portal: () => api.post('/billing/portal/'),
}
