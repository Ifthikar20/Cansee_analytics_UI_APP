<template>
  <SettingsSection
    label="Organization"
    title="Domains"
    description="Prove you own an email domain to unlock auto-join and SSO enforcement."
  >
    <!-- Claim -->
    <div class="od-claim">
      <input
        v-model="claimInput"
        type="text"
        class="od-input"
        placeholder="company.com"
        :disabled="claimBusy"
        @keydown.enter.prevent="claim"
      />
      <Button size="sm" class="od-btn" :disabled="claimBusy || !claimInput.trim()" @click="claim">
        {{ claimBusy ? 'Claiming…' : 'Claim a domain' }}
      </Button>
    </div>
    <p v-if="claimError" class="od-error">{{ claimError }}</p>

    <!-- Domain list -->
    <div v-if="orgStore.domainsLoading && !orgStore.domains.length" class="od-loading">
      Loading domains…
    </div>
    <div v-else-if="domainsFailed && !orgStore.domains.length" class="od-failed">
      <p class="od-empty">We couldn't load your domains.</p>
      <Button variant="outline" size="sm" class="od-btn" @click="loadDomainList">Try again</Button>
    </div>
    <p v-else-if="!orgStore.domains.length" class="od-empty">
      No domains yet. Claim the domain your team's email addresses use.
    </p>

    <ul v-else class="od-list">
      <li v-for="d in orgStore.domains" :key="d.id" class="od-item">
        <div class="od-row">
          <span class="od-domain">{{ d.domain }}</span>
          <Badge :variant="statusVariant(d.status)">{{ statusLabel(d.status) }}</Badge>

          <span class="od-spacer"></span>

          <!-- Auto-join: verified domains only -->
          <label v-if="d.status === 'verified'" class="od-autojoin">
            <span>Auto-join</span>
            <input
              type="checkbox"
              class="od-switch"
              role="switch"
              :checked="d.auto_join"
              :disabled="toggleBusyId === d.id"
              :aria-checked="d.auto_join ? 'true' : 'false'"
              @change="toggleAutoJoin(d, $event)"
            />
          </label>

          <button
            type="button"
            class="od-trash"
            :title="`Remove ${d.domain}`"
            @click="askRemove(d)"
          >
            <Trash2 :size="15" />
          </button>
        </div>

        <p v-if="rowErrors[d.id]" class="od-error">{{ rowErrors[d.id] }}</p>

        <!-- Verified: Microsoft (Entra ID) tenant binding -->
        <div v-if="d.status === 'verified'" class="od-tenant">
          <label class="od-tenant-label" :for="`od-tenant-${d.id}`">Microsoft tenant ID</label>
          <div class="od-tenant-row">
            <input
              :id="`od-tenant-${d.id}`"
              type="text"
              class="od-input od-tenant-input"
              placeholder="Entra tenant GUID"
              :value="tenantValue(d)"
              :disabled="tenantBusyId === d.id"
              @input="onTenantInput(d, $event)"
              @keydown.enter.prevent="saveTenantId(d)"
            />
            <Button size="sm" class="od-btn" :disabled="tenantBusyId === d.id" @click="saveTenantId(d)">
              {{ tenantBusyId === d.id ? 'Saving…' : 'Save' }}
            </Button>
          </div>
          <p class="od-tenant-help">
            Lets @{{ d.domain }} teammates sign in with Microsoft.
            Find it in Azure Portal under Entra ID.
          </p>
        </div>

        <!-- Pending: DNS instruction card -->
        <div v-if="d.status !== 'verified'" class="od-dns">
          <p class="od-dns-title">Add this TXT record at your DNS provider</p>
          <div class="od-dns-grid">
            <span class="od-dns-key">Host</span>
            <code class="od-dns-value">{{ d.txt_host }}</code>
            <button type="button" class="od-copy" @click="copyText(d.txt_host)">Copy</button>

            <span class="od-dns-key">Type</span>
            <code class="od-dns-value">TXT</code>
            <span></span>

            <span class="od-dns-key">Value</span>
            <code class="od-dns-value">{{ d.txt_record }}</code>
            <button type="button" class="od-copy" @click="copyText(d.txt_record)">Copy</button>
          </div>
          <div class="od-dns-foot">
            <Button size="sm" class="od-btn" :disabled="verifyingId === d.id" @click="verify(d)">
              <span v-if="verifyingId === d.id" class="od-spinner" aria-hidden="true"></span>
              {{ verifyingId === d.id ? 'Checking…' : 'Verify now' }}
            </Button>
            <span v-if="verifyNotes[d.id]" class="od-dns-note">{{ verifyNotes[d.id] }}</span>
          </div>
        </div>
      </li>
    </ul>
  </SettingsSection>

  <!-- SSO enforcement: owner only -->
  <SettingsSection
    v-if="authStore.isOrgOwner"
    label="Single sign-on"
    title="SSO enforcement"
    description="Require everyone in the organization to sign in with Google."
    :danger="!ssoEnforced"
  >
    <div class="od-sso-row">
      <span class="od-sso-text">
        <span class="od-sso-title">
          {{ ssoEnforced ? 'SSO is required' : 'SSO is optional' }}
        </span>
        <span class="od-sso-desc">
          {{ ssoEnforced
            ? 'Members can only sign in with Google. Password sign-in and reset are disabled.'
            : 'Members can sign in with a password or with Google.' }}
        </span>
      </span>
      <Button
        size="sm"
        class="od-btn"
        :variant="ssoEnforced ? 'outline' : 'destructive'"
        :disabled="ssoBusy"
        @click="ssoEnforced ? disableSso() : openEnforce()"
      >
        {{ ssoBusy ? 'Working…' : (ssoEnforced ? 'Stop requiring SSO' : 'Require SSO') }}
      </Button>
    </div>
    <p v-if="ssoError && !showEnforceModal" class="od-error">{{ ssoError }}</p>
  </SettingsSection>

  <!-- Remove domain confirm -->
  <BaseModal
    :model-value="!!removeTarget"
    title="Remove domain"
    @update:model-value="removeTarget = null"
  >
    <p class="od-modal-text">
      Remove <b>{{ removeTarget?.domain }}</b>? New sign-ups from this domain
      will no longer join automatically, and it can no longer back SSO
      enforcement.
    </p>
    <p v-if="removeError" class="od-error">{{ removeError }}</p>
    <template #footer>
      <Button variant="outline" size="sm" @click="removeTarget = null">Cancel</Button>
      <Button variant="destructive" size="sm" :disabled="removing" @click="confirmRemove">
        {{ removing ? 'Removing…' : 'Remove domain' }}
      </Button>
    </template>
  </BaseModal>

  <!-- Enable-SSO type-to-confirm -->
  <EnforceSsoConfirmModal
    v-model="showEnforceModal"
    :domain="primaryVerifiedDomain"
    :busy="ssoBusy"
    :error="ssoError"
    @confirm="enableSso"
  />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrgStore } from '@/stores/org'
import { useToast } from '@/composables/useToast'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import EnforceSsoConfirmModal from '@/components/org/EnforceSsoConfirmModal.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from '@lucide/vue'

const authStore = useAuthStore()
const orgStore = useOrgStore()
const toast = useToast()

// ── Claim ──
const claimInput = ref('')
const claimBusy = ref(false)
const claimError = ref('')

// ── Per-row state ──
const verifyingId = ref(null)
const verifyNotes = ref({}) // id -> note under the Verify button
const toggleBusyId = ref(null)
const rowErrors = ref({}) // id -> inline error (e.g. enforce_active)

// ── Microsoft tenant ID ──
// id -> draft value; only set once the user edits, so a store refresh
// doesn't clobber typing and untouched rows track the stored value.
const tenantDrafts = ref({})
const tenantBusyId = ref(null)

// ── Remove ──
const removeTarget = ref(null)
const removeError = ref('')
const removing = ref(false)

// ── SSO ──
const showEnforceModal = ref(false)
const ssoBusy = ref(false)
const ssoError = ref('')

const ssoEnforced = computed(() => authStore.org?.sso_enforced === true)
const primaryVerifiedDomain = computed(
  () => orgStore.domains.find((d) => d.status === 'verified')?.domain || '',
)

function statusVariant(status) {
  if (status === 'verified') return 'success'
  if (status === 'failed') return 'destructive'
  return 'warning' // pending_dns
}
function statusLabel(status) {
  if (status === 'verified') return 'Verified'
  if (status === 'failed') return 'Failed'
  return 'Pending DNS'
}

async function claim() {
  const domain = claimInput.value.trim().toLowerCase()
  if (!domain || claimBusy.value) return
  claimBusy.value = true
  claimError.value = ''
  try {
    await orgStore.claimDomain(domain)
    claimInput.value = ''
    toast.success(`${domain} claimed — now prove you own it with the TXT record below.`)
  } catch (e) {
    const err = e?.response?.data?.error
    if (err?.code === 'domain_claimed') {
      claimError.value = 'That domain is already claimed by another organization.'
    } else if (err?.code === 'validation_error') {
      claimError.value = err?.message || 'Enter a company domain (personal email providers cannot be claimed).'
    } else {
      claimError.value = err?.message || "We couldn't claim that domain."
    }
  } finally {
    claimBusy.value = false
  }
}

async function verify(d) {
  verifyingId.value = d.id
  verifyNotes.value = { ...verifyNotes.value, [d.id]: '' }
  try {
    const row = await orgStore.verifyDomain(d.id)
    if (row?.status === 'verified') {
      toast.success(`${d.domain} verified.`)
      verifyNotes.value = { ...verifyNotes.value, [d.id]: '' }
    } else {
      // 200 with pending_dns: the record just isn't visible yet.
      verifyNotes.value = {
        ...verifyNotes.value,
        [d.id]: "DNS hasn't propagated yet — this can take up to an hour.",
      }
    }
  } catch {
    // Interceptor toasts the failure.
  } finally {
    verifyingId.value = null
  }
}

async function toggleAutoJoin(d, event) {
  const enabled = event.target.checked
  toggleBusyId.value = d.id
  rowErrors.value = { ...rowErrors.value, [d.id]: '' }
  try {
    await orgStore.updateDomain(d.id, { auto_join: enabled })
    toast.success(enabled
      ? `New @${d.domain} sign-ups will join automatically.`
      : `New @${d.domain} sign-ups will no longer join automatically.`)
  } catch {
    // Interceptor toasts; snap the switch back to the stored value.
    event.target.checked = d.auto_join
  } finally {
    toggleBusyId.value = null
  }
}

function tenantValue(d) {
  return tenantDrafts.value[d.id] !== undefined
    ? tenantDrafts.value[d.id]
    : (d.entra_tenant_id || '')
}

function onTenantInput(d, event) {
  tenantDrafts.value = { ...tenantDrafts.value, [d.id]: event.target.value }
}

async function saveTenantId(d) {
  const value = tenantValue(d).trim()
  tenantBusyId.value = d.id
  rowErrors.value = { ...rowErrors.value, [d.id]: '' }
  try {
    await orgStore.updateDomain(d.id, { entra_tenant_id: value })
    const rest = { ...tenantDrafts.value }
    delete rest[d.id]
    tenantDrafts.value = rest
    toast.success(value
      ? `@${d.domain} teammates can now sign in with Microsoft.`
      : `Microsoft sign-in tenant cleared for @${d.domain}.`)
  } catch (e) {
    rowErrors.value = {
      ...rowErrors.value,
      [d.id]: e?.response?.data?.error?.message || "We couldn't save the Microsoft tenant ID.",
    }
  } finally {
    tenantBusyId.value = null
  }
}

function askRemove(d) {
  removeError.value = ''
  removeTarget.value = d
}

async function confirmRemove() {
  if (!removeTarget.value) return
  removing.value = true
  removeError.value = ''
  const d = removeTarget.value
  try {
    await orgStore.removeDomain(d.id)
    toast.success(`${d.domain} removed.`)
    removeTarget.value = null
  } catch (e) {
    const err = e?.response?.data?.error
    if (err?.code === 'enforce_active') {
      removeError.value = 'SSO enforcement relies on this domain — turn enforcement off before removing it.'
    } else {
      removeError.value = err?.message || "We couldn't remove that domain."
    }
  } finally {
    removing.value = false
  }
}

function ssoErrorMessage(e) {
  const err = e?.response?.data?.error
  if (err?.code === 'domain_not_verified') {
    return 'Verify a domain first — SSO can only be required once your email domain is proven.'
  }
  if (err?.code === 'owner_idp_unlinked') {
    return "Sign in with Google once on this account first, so you can't lock yourself out."
  }
  return err?.message || "We couldn't change SSO enforcement."
}

function openEnforce() {
  ssoError.value = ''
  if (!primaryVerifiedDomain.value) {
    // No verified domain means nothing to type-to-confirm — surface the
    // same explanation the backend would return, without a round trip.
    ssoError.value = 'Verify a domain first — SSO can only be required once your email domain is proven.'
    return
  }
  showEnforceModal.value = true
}

async function enableSso() {
  ssoBusy.value = true
  ssoError.value = ''
  try {
    const data = await orgStore.setSsoEnforcement(true)
    showEnforceModal.value = false
    toast.success(`SSO required — ${data?.sessions_revoked ?? 0} team session(s) signed out`)
    await authStore.fetchSession()
  } catch (e) {
    ssoError.value = ssoErrorMessage(e)
  } finally {
    ssoBusy.value = false
  }
}

async function disableSso() {
  if (!window.confirm('Stop requiring SSO? Members will be able to sign in with a password again.')) return
  ssoBusy.value = true
  ssoError.value = ''
  try {
    await orgStore.setSsoEnforcement(false)
    toast.success('SSO is no longer required.')
    await authStore.fetchSession()
  } catch (e) {
    ssoError.value = ssoErrorMessage(e)
  } finally {
    ssoBusy.value = false
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ''))
    toast.success('Copied.')
  } catch {
    toast.error("Couldn't copy — select the value and copy it manually.")
  }
}

// ── Loading ──
const domainsFailed = ref(false)

async function loadDomainList() {
  domainsFailed.value = false
  try {
    await orgStore.loadDomains()
  } catch {
    domainsFailed.value = true
  }
}

onMounted(loadDomainList)
</script>

<style scoped>
/* ── Claim row ── */
.od-claim {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.od-input {
  flex: 1 1 200px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.od-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}
.od-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius);
  font-size: 13px;
}

.od-error {
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--destructive);
}
.od-loading,
.od-empty {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--muted-foreground);
}
.od-failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

/* ── Domain rows ── */
.od-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.od-item {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}
.od-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.od-domain {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}
.od-spacer { flex: 1; }

.od-autojoin {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground);
  cursor: pointer;
}

/* Same anatomy as the notifications switch in SettingsPage (scoped
   there, so restated here). */
.od-switch {
  appearance: none;
  -webkit-appearance: none;
  flex: none;
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  border: 0;
  border-radius: var(--radius);
  background: var(--input);
  cursor: pointer;
  transition: background-color 160ms ease;
}
.od-switch::before {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 0;
  background: var(--background);
  box-shadow: none;
  transition: transform 160ms ease;
}
[data-theme='dark'] .od-switch:not(:checked) { background: var(--bar); }
.od-switch:checked { background: var(--primary); }
.od-switch:checked::before { transform: translateX(16px); }
.od-switch:disabled { opacity: 0.6; cursor: default; }
.od-switch:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

.od-trash {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 120ms ease, background-color 120ms ease;
}
.od-trash:hover {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 10%, transparent);
}

/* ── Microsoft tenant ID ── */
.od-tenant {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.od-tenant-label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  font-family: var(--font-mono);
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.od-tenant-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.od-tenant-input {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
}
.od-tenant-help {
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--muted-foreground);
}

/* ── DNS instruction card ── */
.od-dns {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--muted);
}
.od-dns-title {
  margin: 0 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--foreground);
}
.od-dns-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 6px 12px;
  align-items: center;
}
.od-dns-key {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  font-family: var(--font-mono);
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.od-dns-value {
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--background);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--foreground);
}
.od-copy {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3px 10px;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}
.od-copy:hover { color: var(--foreground); border-color: var(--foreground); }
.od-dns-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.od-dns-note {
  font-size: 12.5px;
  color: var(--muted-foreground);
}
.od-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: od-spin 0.7s linear infinite;
}
@keyframes od-spin { to { transform: rotate(360deg); } }

/* ── SSO card ── */
.od-sso-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.od-sso-text { display: flex; flex-direction: column; min-width: 0; }
.od-sso-title { font-size: 13px; font-weight: 600; color: var(--foreground); }
.od-sso-desc {
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--muted-foreground);
}

.od-modal-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--foreground);
}
</style>
