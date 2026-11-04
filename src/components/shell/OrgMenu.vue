<script setup>
// The header's organization chip, for organization (B2B) accounts only:
// session.org is null for individual users, who never see it. Its menu
// opens Team members, and Domains and SSO for admins and owners. Styled by
// AppHeader.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck, Users } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { useAuthStore } from '@/stores/auth'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }

const router = useRouter()
const auth = useAuthStore()

const org = computed(() => auth.org)
const mark = computed(() => (org.value?.name || 'O').charAt(0).toUpperCase())
const roleLabel = computed(() => ROLE_LABELS[auth.orgRole] || auth.orgRole || '')

function goSettings(section) {
  router.push({ path: '/settings', query: { section } })
}
</script>

<template>
  <span v-if="org" class="shell-org">
    <span class="shell-sep" aria-hidden="true">/</span>
    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <button type="button" class="shell-chip" :aria-label="`Organization: ${org.name}`">
          <span class="shell-org-mark" aria-hidden="true">{{ mark }}</span>
          <span class="shell-chip-text">{{ org.name }}</span>
          <span v-if="roleLabel" class="shell-role">{{ roleLabel }}</span>
        </button>
      </DropdownMenuTrigger>

      <AgMenuContent align="start" :width="240">
        <AgMenuLabel>
          <span class="ag-menu-text">{{ org.name }}</span>
        </AgMenuLabel>
        <AgMenuItem @select="goSettings('team')">
          <Users aria-hidden="true" />
          Team members
        </AgMenuItem>
        <AgMenuItem v-if="auth.isOrgAdmin" @select="goSettings('domains')">
          <ShieldCheck aria-hidden="true" />
          Domains and SSO
        </AgMenuItem>
      </AgMenuContent>
    </DropdownMenuRoot>
  </span>
</template>
