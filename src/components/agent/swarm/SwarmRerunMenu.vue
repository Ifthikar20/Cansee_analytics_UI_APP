<template>
  <span class="ag-swarm-rerun" :class="`is-${variant}`">
    <DropdownMenuRoot :open="menuOpen" :modal="false" @update:open="setOpen">
      <DropdownMenuTrigger v-if="variant === 'icon'" as-child>
        <AgIconButton
          class="ag-swarm-rerun-trigger"
          label="Re-run"
          :tooltip="disabled ? disabledReason : 'Re-run'"
          :size="28"
          :icon-size="15"
          :aria-disabled="disabled ? 'true' : undefined"
        >
          <RotateCw aria-hidden="true" />
        </AgIconButton>
      </DropdownMenuTrigger>
      <AgTooltip v-else :text="disabled ? disabledReason : ''">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="ag-swarm-rerun-trigger ag-swarm-rerun-btn"
            :aria-disabled="disabled ? 'true' : undefined"
            :aria-busy="pending ? 'true' : undefined"
          >
            <AgSpinner v-if="pending" :size="14" />
            <RotateCw v-else :size="14" aria-hidden="true" />
            <span>Re-run</span>
          </button>
        </DropdownMenuTrigger>
      </AgTooltip>
      <AgMenuContent align="end" :width="272">
        <AgMenuItem @select="run('all')">
          <RotateCw :size="16" aria-hidden="true" />
          <span class="ag-menu-text">Re-run all agents</span>
          <template v-if="total" #trail>
            <span class="ag-tnum">{{ agents(total) }}</span>
          </template>
        </AgMenuItem>
        <template v-if="categoryItems.length">
          <AgMenuSeparator />
          <AgMenuLabel>Re-run a category</AgMenuLabel>
          <AgMenuItem v-for="item in categoryItems" :key="item.key" @select="run('category', item.key)">
            <component :is="item.icon" :size="16" aria-hidden="true" />
            <span class="ag-menu-text">{{ item.label }}</span>
            <template v-if="item.count" #trail>
              <span class="ag-tnum">{{ agents(item.count) }}</span>
            </template>
          </AgMenuItem>
        </template>
      </AgMenuContent>
    </DropdownMenuRoot>
  </span>
</template>

<script setup>
// Re-run a research: all agents, or one category's. Each choice starts a new
// turn at the end of the chat (a new version of the same swarm). Disabled,
// with the reason in its tooltip, while the chat is working on a reply.
import { computed, ref, watch } from 'vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { Building2, FileText, Link2, RotateCw, Search, Sparkles } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuLabel from '@/components/agent/common/AgMenuLabel.vue'
import AgMenuSeparator from '@/components/agent/common/AgMenuSeparator.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { useToast } from '@/composables/useToast'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { rerunErrorText } from './swarmView'

const ICONS = { google: Search, engines: Sparkles, competitors: Building2, site: FileText, sources: Link2 }

const props = defineProps({
  swarmId: { type: String, required: true },
  chatId: { type: [String, Number], required: true },
  disabled: { type: Boolean, default: false },
  disabledReason: { type: String, default: 'Wait for the current reply to finish.' },
  // [{key, label, task_ids?}]; defaults to agent.swarmCategories(swarmId).
  categories: { type: Array, default: null },
  // The swarm's tasks when the caller has all of them (a part of scope
  // `all`), for the agent counts before the swarm detail loads.
  tasks: { type: Array, default: null },
  // icon: the 28px header button; button: the table footer's text button.
  variant: { type: String, default: 'icon' },
})

const agent = useAgentStore()
const ui = useAgentUiStore()
const toast = useToast()

const menuOpen = ref(false)
const pending = ref(false)

const entry = computed(() => (agent.swarms && agent.swarms[props.swarmId]) || null)
const detail = computed(() => (entry.value && entry.value.detail) || null)

// Every task of the swarm: from its detail, else from the caller, else from
// a loaded part of scope `all`.
const allTasks = computed(() => {
  if (detail.value && Array.isArray(detail.value.tasks) && detail.value.tasks.length) return detail.value.tasks
  if (Array.isArray(props.tasks) && props.tasks.length) return props.tasks
  for (const message of Object.values(agent.messages || {})) {
    for (const part of (message && message.parts) || []) {
      if (part && part.type === 'swarm' && part.swarm_id === props.swarmId && part.scope === 'all' && Array.isArray(part.tasks)) {
        return part.tasks
      }
    }
  }
  return []
})

const categoryItems = computed(() => {
  const source = Array.isArray(props.categories) ? props.categories : agent.swarmCategories(props.swarmId) || []
  return source
    .filter((c) => c && c.key)
    .map((c) => {
      const ids = Array.isArray(c.task_ids) ? c.task_ids : null
      const counted = allTasks.value.filter((t) => t && t.category === c.key).length
      const count = ids && ids.length ? ids.length : counted
      // Nothing known about its agents yet (no detail, no tasks): offer it.
      const known = Boolean(ids) || allTasks.value.length > 0
      return { key: c.key, label: c.label || c.key, icon: ICONS[c.key] || Search, count, known }
    })
    // A category with notes only has no agent to run.
    .filter((item) => !item.known || item.count > 0)
})

const total = computed(() => allTasks.value.length || categoryItems.value.reduce((n, item) => n + (item.count || 0), 0))

function agents(n) {
  return `${n} ${n === 1 ? 'agent' : 'agents'}`
}

function setOpen(value) {
  if (value && props.disabled) return
  menuOpen.value = value
  if (value && !detail.value && !(entry.value && entry.value.loading)) {
    // Counts per category come with the detail; the menu works without it.
    Promise.resolve(agent.loadSwarm(props.swarmId)).catch(() => {})
  }
}

watch(
  () => props.disabled,
  (off) => {
    if (off) menuOpen.value = false
  }
)

async function run(scope, category = null) {
  if (props.disabled || pending.value) return
  pending.value = true
  try {
    await agent.rerunSwarm({ chatId: String(props.chatId), swarmId: props.swarmId, scope, category })
  } catch (error) {
    const text = rerunErrorText(error)
    toast.error(text)
    ui.announce(text, 'assertive')
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.ag-swarm-rerun {
  display: inline-flex;
  flex-shrink: 0;
}

/* Disabled triggers keep hover and focus so the tooltip can say why. */
.ag-swarm-rerun :deep(.ag-swarm-rerun-trigger[aria-disabled='true']) {
  color: var(--ag-fg-disabled);
  cursor: default;
  pointer-events: auto;
}

.ag-swarm-rerun :deep(.ag-swarm-rerun-trigger[aria-disabled='true']:hover) {
  background: transparent;
}

/* The footer's text trigger, in the look of AgButton xs ghost. */
.ag-swarm-rerun-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 26px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-swarm-rerun-btn:hover:not([aria-disabled='true']),
.ag-swarm-rerun-btn[aria-expanded='true'] {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-swarm-rerun-btn[aria-disabled='true'] {
  opacity: 0.5;
}

.ag-swarm-rerun-btn:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
