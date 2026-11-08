<script setup>
// The header's avatar and account menu: who is signed in, Account, Usage
// dashboard, Billing and Sign out. Styled by AppHeader, apart from the
// two-line label inside the menu.
import { useRouter } from 'vue-router'
import { CreditCard, Gauge, LogOut, UserRound } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { useAuthStore } from '@/stores/auth'
import { useAgentUiStore } from '@/stores/agentUi'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'
import AgMenuSeparator from '@/components/agent/common/AgMenuSeparator.vue'

const router = useRouter()
const auth = useAuthStore()
const ui = useAgentUiStore()

async function signOut() {
  try {
    await auth.logout()
  } finally {
    ui.reset()
    router.push('/login').catch(() => {})
  }
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button type="button" class="shell-avatar" aria-label="Account menu">{{ auth.userInitials }}</button>
    </DropdownMenuTrigger>

    <AgMenuContent align="end" :width="240">
      <AgMenuLabel class="shell-account">
        <span class="shell-account-name">{{ auth.user?.full_name || 'Account' }}</span>
        <span v-if="auth.user?.email" class="shell-account-email">{{ auth.user.email }}</span>
      </AgMenuLabel>
      <AgMenuSeparator />
      <AgMenuItem @select="router.push('/settings')">
        <UserRound aria-hidden="true" />
        Account
      </AgMenuItem>
      <AgMenuItem @select="router.push({ name: 'settings-command-center' })">
        <Gauge aria-hidden="true" />
        Usage dashboard
      </AgMenuItem>
      <AgMenuItem @select="router.push('/billing')">
        <CreditCard aria-hidden="true" />
        Billing
      </AgMenuItem>
      <AgMenuSeparator />
      <AgMenuItem @select="signOut">
        <LogOut aria-hidden="true" />
        Sign out
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>

<style scoped>
/* portal.css lays .ag-menu-label out as one 12px row; the name and the
   email stack here, the name in the menu's ink. */
.ag-menu .shell-account {
  display: grid;
  min-width: 0;
}

.shell-account-name,
.shell-account-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-account-name {
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}
</style>
