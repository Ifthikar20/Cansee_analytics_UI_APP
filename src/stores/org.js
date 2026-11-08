import { defineStore } from 'pinia'
import { ref } from 'vue'
import orgsApi from '@/api/orgs'
import { useAuthStore } from '@/stores/auth'

/**
 * Organization COLLECTIONS only — members, invitations, domains.
 *
 * Identity (which org, my role, sso_enforced) lives on the auth store's
 * session payload and never here; this store holds the lists the org
 * settings screens render, plus the mutators that keep them in sync
 * with the API without a full reload per action.
 *
 * Every loader no-ops when the session has no org, so B2C accounts can
 * mount org-aware components without a single wasted request.
 */
export const useOrgStore = defineStore('org', () => {
    const members = ref([])
    const invitations = ref([])
    const domains = ref([])

    const membersLoading = ref(false)
    const domainsLoading = ref(false)

    function hasOrg() {
        return !!useAuthStore().org
    }

    // ── Members ──
    async function loadMembers() {
        if (!hasOrg()) return
        membersLoading.value = true
        try {
            const { data } = await orgsApi.listMembers()
            members.value = Array.isArray(data) ? data : []
        } finally {
            membersLoading.value = false
        }
    }

    async function changeMemberRole(memberId, role) {
        const { data } = await orgsApi.changeMemberRole(memberId, role)
        const idx = members.value.findIndex((m) => m.id === memberId)
        if (idx !== -1) {
            // Merge defensively: if the API returns the updated row use it,
            // otherwise at least reflect the role we just set.
            members.value[idx] = { ...members.value[idx], ...(data || {}), role: data?.role ?? role }
        }
        return data
    }

    async function removeMember(memberId) {
        await orgsApi.removeMember(memberId)
        members.value = members.value.filter((m) => m.id !== memberId)
    }

    // ── Invitations ──
    async function loadInvitations() {
        // The invitations endpoint is admin-only (IsOrgAdmin). Members would
        // get a guaranteed 403 and a permission toast on every Team visit.
        if (!hasOrg() || !useAuthStore().isOrgAdmin) {
            invitations.value = []
            return
        }
        const { data } = await orgsApi.listInvitations()
        invitations.value = Array.isArray(data) ? data : []
    }

    async function createInvitation(payload) {
        const { data } = await orgsApi.createInvitation(payload)
        if (data?.id) invitations.value.push(data)
        else await loadInvitations()
        return data
    }

    async function revokeInvitation(id) {
        await orgsApi.revokeInvitation(id)
        invitations.value = invitations.value.filter((i) => i.id !== id)
    }

    async function resendInvitation(id) {
        const { data } = await orgsApi.resendInvitation(id)
        const idx = invitations.value.findIndex((i) => i.id === id)
        if (idx !== -1 && data?.id) invitations.value[idx] = data
        return data
    }

    // ── Domains ──
    async function loadDomains() {
        if (!hasOrg()) return
        domainsLoading.value = true
        try {
            const { data } = await orgsApi.listDomains()
            domains.value = Array.isArray(data) ? data : []
        } finally {
            domainsLoading.value = false
        }
    }

    async function claimDomain(domain) {
        const { data } = await orgsApi.claimDomain(domain)
        if (data?.id) domains.value.push(data)
        else await loadDomains()
        return data
    }

    async function verifyDomain(id) {
        // 200 either way — the row's status says whether DNS resolved.
        const { data } = await orgsApi.verifyDomain(id)
        const idx = domains.value.findIndex((d) => d.id === id)
        if (idx !== -1 && data?.id) domains.value[idx] = data
        return data
    }

    async function updateDomain(id, payload) {
        const { data } = await orgsApi.updateDomain(id, payload)
        const idx = domains.value.findIndex((d) => d.id === id)
        if (idx !== -1) domains.value[idx] = { ...domains.value[idx], ...(data || payload) }
        return data
    }

    async function removeDomain(id) {
        await orgsApi.removeDomain(id)
        domains.value = domains.value.filter((d) => d.id !== id)
    }

    // ── Usage (admin-only rollup: seats + per-member prompt/AI usage) ──
    const usage = ref(null)

    async function loadUsage() {
        // The endpoint is admin-gated; skip entirely for members so the
        // Team page never fires a guaranteed 403.
        if (!hasOrg() || !useAuthStore().isOrgAdmin) return
        try {
            const { data } = await orgsApi.getUsage()
            usage.value = data || null
        } catch {
            usage.value = null
        }
    }

    // ── SSO ──
    async function setSsoEnforcement(enabled) {
        // Returns {require_sso, sessions_revoked}. The org's sso_enforced
        // flag lives on the session — callers refresh it via
        // authStore.fetchSession() after this resolves.
        const { data } = await orgsApi.setSsoEnforcement(enabled)
        return data
    }

    /** Drop every list; the next account must not see this one's org. */
    function reset() {
        members.value = []
        invitations.value = []
        domains.value = []
        usage.value = null
        membersLoading.value = false
        domainsLoading.value = false
    }

    // Sign-out clears the lists before clearAuth returns, as the agent and
    // board stores do.
    useAuthStore().onClearAuth(() => reset())

    return {
        reset,
        members,
        invitations,
        domains,
        usage,
        membersLoading,
        domainsLoading,
        loadUsage,
        loadMembers,
        changeMemberRole,
        removeMember,
        loadInvitations,
        createInvitation,
        revokeInvitation,
        resendInvitation,
        loadDomains,
        claimDomain,
        verifyDomain,
        updateDomain,
        removeDomain,
        setSsoEnforcement,
    }
})
