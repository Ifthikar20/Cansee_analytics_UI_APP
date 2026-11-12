<template>
  <SettingsSection
    label="Organization"
    title="Members"
    :description="`People with access to ${authStore.org?.name || 'your organization'}.`"
  >
    <!-- Invite composer toggle + seat meter -->
    <div v-if="authStore.isOrgAdmin" class="om-toolbar">
      <span v-if="seats" class="om-seats" :class="{ 'om-seats--full': seats.used >= seats.max }">
        {{ seats.used }} of {{ seats.max }} seats used
        <HelpTip :text="TIPS.settings.seats" label="About seats" />
      </span>
      <Button size="sm" class="om-btn" @click="composerOpen = !composerOpen">
        {{ composerOpen ? 'Close' : 'Invite people' }}
      </Button>
    </div>

    <!-- Inline invite composer -->
    <div v-if="composerOpen && authStore.isOrgAdmin" class="om-composer">
      <div class="om-composer-row">
        <input
          v-model="inviteEmails"
          type="text"
          class="om-input"
          placeholder="name@company.com"
          :disabled="inviteBusy"
          @keydown.enter.prevent="sendInvites"
        />
        <select v-model="inviteRole" class="om-select" aria-label="Role" :disabled="inviteBusy">
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
          <!-- Only the owner can mint new admins. -->
          <option v-if="authStore.isOrgOwner" value="admin">Admin</option>
        </select>
        <HelpTip :text="TIPS.settings.roles" label="About roles" />
        <Button size="sm" class="om-btn" :disabled="inviteBusy || !inviteEmails.trim()" @click="sendInvites">
          {{ inviteBusy ? 'Sending…' : 'Send invites' }}
        </Button>
      </div>
      <p class="om-hint">Separate multiple addresses with commas.</p>
      <ul v-if="inviteErrors.length" class="om-errors">
        <li v-for="err in inviteErrors" :key="err.email">
          <b>{{ err.email }}</b> — {{ err.message }}
        </li>
      </ul>
    </div>

    <!-- Members table -->
    <div v-if="orgStore.membersLoading && !orgStore.members.length" class="om-loading">
      Loading members…
    </div>
    <div v-else-if="membersFailed && !orgStore.members.length" class="om-failed">
      <p class="om-loading">We couldn't load your team.</p>
      <Button variant="outline" size="sm" class="om-btn" @click="loadTeam">Try again</Button>
    </div>
    <p v-else-if="!orgStore.members.length" class="om-loading">No members yet.</p>
    <div v-else class="om-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead v-if="authStore.isOrgAdmin">Prompts this month</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="m in orgStore.members" :key="m.id">
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar class="size-8 rounded-lg">
                  <AvatarFallback class="rounded-lg text-xs">{{ initials(m.user?.full_name) }}</AvatarFallback>
                </Avatar>
                <div class="grid min-w-0 leading-tight">
                  <span class="truncate text-sm font-medium text-foreground">{{ m.user?.full_name || '—' }}</span>
                  <span class="truncate text-xs text-muted-foreground">{{ m.user?.email }}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <!-- can_manage is computed server-side against the full role
                   ladder; the UI never re-derives it — no editable control
                   unless the API says this row is manageable by me. -->
              <select
                v-if="m.can_manage"
                class="om-select om-select--sm"
                :value="m.role"
                :disabled="roleBusyId === m.id"
                @change="onRoleChange(m, $event)"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <Badge v-else :variant="roleBadgeVariant(m.role)">{{ roleLabel(m.role) }}</Badge>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">{{ formatDate(m.created_at) }}</TableCell>
            <TableCell v-if="authStore.isOrgAdmin" class="text-sm text-muted-foreground">
              {{ usageFor(m) }}
            </TableCell>
            <TableCell class="text-right">
              <button
                v-if="m.can_manage"
                type="button"
                class="om-danger-link"
                @click="removeTarget = m"
              >Remove</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pending invitations -->
    <template v-if="orgStore.invitations.length">
      <h4 class="om-subhead">Pending invitations</h4>
      <div class="om-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Invited by</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="inv in orgStore.invitations" :key="inv.id">
              <TableCell class="text-sm font-medium text-foreground">{{ inv.email }}</TableCell>
              <TableCell><Badge variant="secondary">{{ roleLabel(inv.role) }}</Badge></TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ inv.invited_by?.full_name || '—' }}</TableCell>
              <TableCell class="text-sm text-muted-foreground">{{ formatDate(inv.expires_at) }}</TableCell>
              <TableCell class="text-right">
                <div class="om-row-actions">
                  <button
                    type="button"
                    class="om-quiet-link"
                    :disabled="actionBusyId === inv.id"
                    @click="resend(inv)"
                  >Resend</button>
                  <button
                    type="button"
                    class="om-danger-link"
                    :disabled="actionBusyId === inv.id"
                    @click="revoke(inv)"
                  >Revoke</button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </template>

    <!-- Remove member confirm -->
    <BaseModal
      :model-value="!!removeTarget"
      title="Remove member"
      @update:model-value="removeTarget = null"
    >
      <p class="om-modal-text">
        Remove <b>{{ removeTarget?.user?.full_name || removeTarget?.user?.email }}</b>
        from {{ authStore.org?.name || 'the organization' }}? They lose access
        immediately, but their account itself is not deleted.
      </p>
      <template #footer>
        <Button variant="outline" size="sm" @click="removeTarget = null">Cancel</Button>
        <Button variant="destructive" size="sm" :disabled="removing" @click="confirmRemove">
          {{ removing ? 'Removing…' : 'Remove member' }}
        </Button>
      </template>
    </BaseModal>
  </SettingsSection>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrgStore } from '@/stores/org'
import { useToast } from '@/composables/useToast'
import SettingsSection from '@/components/settings/SettingsSection.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { TIPS } from '@/lib/help/tips'
import BaseModal from '@/components/ui/BaseModal.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const authStore = useAuthStore()
const orgStore = useOrgStore()
const toast = useToast()

// Seats: prefer the fresh usage rollup (admins), fall back to the
// session's limits block. Absent entirely = unlimited seats, no meter.
const seats = computed(() =>
  orgStore.usage?.seats || authStore.session?.limits?.seats || null
)

// "12 / 200" per member, from the admin usage rollup keyed by user id.
function usageFor(member) {
  const row = orgStore.usage?.members?.find(
    (r) => r.user?.id === member.user?.id
  )
  if (!row) return '—'
  const allowance = row.prompt_allowance
  return allowance > 0 ? `${row.prompts_used} / ${allowance}` : `${row.prompts_used}`
}

// ── Invite composer ──
const composerOpen = ref(false)
const inviteEmails = ref('')
const inviteRole = ref('member')
const inviteBusy = ref(false)
const inviteErrors = ref([]) // [{email, message}]

// ── Loading ──
const membersFailed = ref(false)

async function loadTeam() {
  membersFailed.value = false
  try {
    await orgStore.loadMembers()
  } catch {
    membersFailed.value = true
  }
}

// ── Row actions ──
const roleBusyId = ref(null)
const actionBusyId = ref(null)
const removeTarget = ref(null)
const removing = ref(false)

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
function roleLabel(role) {
  return ROLE_LABELS[role] || role || ''
}
function roleBadgeVariant(role) {
  if (role === 'owner') return 'default'
  if (role === 'admin') return 'secondary'
  return 'outline'
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function inviteErrorMessage(e) {
  const err = e?.response?.data?.error
  switch (err?.code) {
    case 'already_invited':
      return 'That address already has a pending invitation.'
    case 'already_member':
      return 'That person is already a member of this organization.'
    case 'plan_limit_exceeded':
      return err?.message || 'Your plan has reached its seat limit.'
    case 'validation_error':
      return err?.message || 'Enter a valid email address.'
    default:
      return err?.message || "We couldn't send that invitation."
  }
}

async function sendInvites() {
  const emails = inviteEmails.value.split(',').map((s) => s.trim()).filter(Boolean)
  if (!emails.length || inviteBusy.value) return
  inviteBusy.value = true
  inviteErrors.value = []
  let sent = 0
  // Sequential on purpose: each failure maps cleanly to one address.
  for (const email of emails) {
    try {
      await orgStore.createInvitation({ email, role: inviteRole.value })
      sent++
    } catch (e) {
      inviteErrors.value.push({ email, message: inviteErrorMessage(e) })
    }
  }
  if (sent) {
    toast.success(sent === 1 ? 'Invitation sent.' : `${sent} invitations sent.`)
    orgStore.loadUsage() // pending invites occupy seats — refresh the meter
  }
  if (!inviteErrors.value.length) {
    inviteEmails.value = ''
    composerOpen.value = false
  } else {
    // Keep only the failed addresses in the input for a quick retry.
    inviteEmails.value = inviteErrors.value.map((x) => x.email).join(', ')
  }
  inviteBusy.value = false
}

async function onRoleChange(member, event) {
  const role = event.target.value
  if (role === member.role) return
  roleBusyId.value = member.id
  try {
    await orgStore.changeMemberRole(member.id, role)
    toast.success(`${member.user?.full_name || member.user?.email} is now ${roleLabel(role).toLowerCase()}.`)
  } catch {
    // Global interceptor already toasted; put the select back in sync.
    event.target.value = member.role
    await loadTeam()
  } finally {
    roleBusyId.value = null
  }
}

async function confirmRemove() {
  if (!removeTarget.value) return
  removing.value = true
  try {
    await orgStore.removeMember(removeTarget.value.id)
    toast.success('Member removed.')
    removeTarget.value = null
    orgStore.loadUsage()
  } catch {
    // Interceptor toasts the failure.
  } finally {
    removing.value = false
  }
}

async function resend(inv) {
  actionBusyId.value = inv.id
  try {
    await orgStore.resendInvitation(inv.id)
    toast.success(`Invitation resent to ${inv.email}.`)
  } catch {
    // Interceptor toasts the failure.
  } finally {
    actionBusyId.value = null
  }
}

async function revoke(inv) {
  actionBusyId.value = inv.id
  try {
    await orgStore.revokeInvitation(inv.id)
    toast.success(`Invitation to ${inv.email} revoked.`)
    orgStore.loadUsage()
  } catch {
    // Interceptor toasts the failure.
  } finally {
    actionBusyId.value = null
  }
}

onMounted(() => {
  loadTeam()
  // Pending invitations are optional extras; the interceptor reports a failure.
  orgStore.loadInvitations().catch(() => {})
  orgStore.loadUsage()
})
</script>

<style scoped>
.om-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  --cs-helptip-fg: var(--muted-foreground);
  --cs-helptip-fg-hover: var(--foreground);
}
.om-seats {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
}
.om-seats--full { color: var(--destructive); }
.om-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius);
  font-size: 13px;
}

.om-composer {
  margin-bottom: 18px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--muted);
}
.om-composer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  --cs-helptip-fg: var(--muted-foreground);
  --cs-helptip-fg-hover: var(--foreground);
}
.om-input {
  flex: 1 1 220px;
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
.om-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}
.om-select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.om-select--sm {
  height: 30px;
  font-size: 12px;
  border-radius: var(--radius);
}
.om-select:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 16%, transparent);
}
.om-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--muted-foreground);
}
.om-errors {
  margin: 10px 0 0;
  padding: 0 0 0 18px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--destructive);
}

.om-loading {
  padding: 18px 0;
  font-size: 13px;
  color: var(--muted-foreground);
}
.om-failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 18px;
}
.om-failed .om-loading { padding-bottom: 10px; }
.om-table-wrap { overflow-x: auto; }

.om-subhead {
  margin: 26px 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  font-family: var(--font-mono);
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.om-row-actions {
  display: inline-flex;
  gap: 14px;
}
.om-quiet-link,
.om-danger-link {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--muted-foreground);
  transition: color 120ms ease;
}
.om-quiet-link:hover { color: var(--foreground); }
.om-danger-link { color: var(--destructive); opacity: 0.85; }
.om-danger-link:hover { opacity: 1; }
.om-quiet-link:disabled,
.om-danger-link:disabled { opacity: 0.5; cursor: default; }

.om-modal-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--foreground);
}
</style>
