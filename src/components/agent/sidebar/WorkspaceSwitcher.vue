<script setup>
// Project switcher and account menu: organisation, projects, add project,
// project settings, appearance, account, billing, sign out.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  SlidersHorizontal,
  Sun,
  SunMoon,
  UserRound,
} from '@lucide/vue'
import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'reka-ui'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAgentUiStore } from '@/stores/agentUi'
import { useProjectSwitch } from '@/composables/agent/useProjectSwitch'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'
import AgMenuSeparator from '@/components/agent/common/AgMenuSeparator.vue'
import AgMenuSubContent from '@/components/agent/common/AgMenuSubContent.vue'
import AgMonogram from '@/components/agent/common/AgMonogram.vue'

const props = defineProps({
  website: { type: Object, default: null },
})

const router = useRouter()
const app = useAppStore()
const auth = useAuthStore()
const ui = useAgentUiStore()
const { switchProject } = useProjectSwitch()

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }
const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const projectName = computed(() => props.website?.name || 'No project')
const org = computed(() => auth.org)
const roleLabel = computed(() => ROLE_LABELS[auth.orgRole] || auth.orgRole || '')
const themeLabel = computed(() => THEMES.find((t) => t.value === app.theme)?.label || 'Light')
const accountLine = computed(() => auth.user?.email || auth.user?.full_name || '')

const theme = computed({
  get: () => app.theme,
  set: (value) => app.setTheme(value),
})

function isCurrent(w) {
  return props.website && String(w.id) === String(props.website.id)
}

function selectProject(w) {
  switchProject(w.id)
}

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
      <button type="button" class="ag-ws" :aria-label="`Project: ${projectName}. Open project and account menu`">
        <AgMonogram :name="website?.name || ''" :size="18" />
        <span class="ag-ws-name">{{ projectName }}</span>
        <ChevronsUpDown class="ag-ws-chevrons" :size="16" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>

    <AgMenuContent align="start" :width="260">
      <template v-if="org">
        <AgMenuLabel>
          <span class="ag-menu-text">{{ org.name }}</span>
          <span v-if="roleLabel" class="ag-ws-role">{{ roleLabel }}</span>
        </AgMenuLabel>
        <AgMenuSeparator />
      </template>

      <AgMenuLabel>Projects</AgMenuLabel>
      <AgMenuItem
        v-for="w in app.websites"
        :key="w.id"
        :text-value="w.name"
        @select="selectProject(w)"
      >
        <AgMonogram :name="w.name" :size="18" />
        <span class="ag-menu-text">{{ w.name }}</span>
        <template v-if="isCurrent(w)" #trail>
          <Check :size="16" aria-hidden="true" />
          <span class="ag-sr-only">(current)</span>
        </template>
      </AgMenuItem>
      <AgMenuItem @select="ui.openAddProject()">
        <Plus aria-hidden="true" />
        Add project
      </AgMenuItem>
      <AgMenuItem v-if="website" @select="router.push({ name: 'settings-project' })">
        <SlidersHorizontal aria-hidden="true" />
        Project settings
      </AgMenuItem>

      <AgMenuSeparator />

      <DropdownMenuSub>
        <DropdownMenuSubTrigger class="ag-menu-item">
          <SunMoon aria-hidden="true" />
          <span class="ag-menu-text">Appearance</span>
          <span class="ag-menu-trail">
            {{ themeLabel }}
            <ChevronRight :size="16" aria-hidden="true" />
          </span>
        </DropdownMenuSubTrigger>
        <AgMenuSubContent>
          <DropdownMenuRadioGroup v-model="theme">
            <DropdownMenuRadioItem v-for="t in THEMES" :key="t.value" :value="t.value" class="ag-menu-item">
              <component :is="t.icon" aria-hidden="true" />
              <span class="ag-menu-text">{{ t.label }}</span>
              <span class="ag-menu-trail">
                <DropdownMenuItemIndicator>
                  <Check :size="16" aria-hidden="true" />
                </DropdownMenuItemIndicator>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </AgMenuSubContent>
      </DropdownMenuSub>

      <AgMenuSeparator />
      <AgMenuLabel v-if="accountLine">
        <span class="ag-menu-text">{{ accountLine }}</span>
      </AgMenuLabel>
      <AgMenuItem @select="router.push('/settings')">
        <UserRound aria-hidden="true" />
        Account
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
.ag-ws {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: calc(100% - 40px);
  height: 36px;
  margin: 0;
  padding: 0 8px 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ag-fg-1);
  cursor: pointer;
  transition: background-color 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

.ag-ws:hover,
.ag-ws[data-state='open'] {
  background: var(--ag-row-hover);
}

.ag-ws:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-ws-name {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-ws-chevrons {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--ag-fg-3);
}

.ag-ws-role {
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 7px;
  border: 1px solid var(--ag-divider);
  border-radius: 999px;
  color: var(--ag-fg-3);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
}
</style>
