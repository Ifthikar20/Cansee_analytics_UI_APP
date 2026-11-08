<script setup>
// What this workspace has set up for the agents (GET status/), so a missing
// key does not look like a broken agent: Google results, the AI engines,
// and what is left this month (free prompt runs for a free account, which
// never sees dollars; the AI allowance for a paid one). When something
// stops every agent, it says what and what to do, with Check again.
//
// Customers read plain words; staff and DEBUG servers also get the setting
// to change (lib/agent/availability, lib/agent/setup).
import { computed } from 'vue'
import { CircleAlert } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { blockHelp, listNames, setupSummary } from '@/lib/agent/availability'
import { TIPS } from '@/lib/help/tips'

const props = defineProps({
  // GET status/
  status: { type: Object, default: null },
  // what stops every agent ({title, action, setting}), or null
  block: { type: Object, default: null },
  // a status/ request is in flight
  checking: { type: Boolean, default: false },
})

const emit = defineEmits(['refresh'])

const summary = computed(() => setupSummary(props.status))

const googleText = computed(() => {
  const g = summary.value?.google
  if (!g) return ''
  if (!g.configured) return 'Not set up'
  return g.note ? `Set up, ${g.note}` : 'Set up'
})

const engines = computed(() => summary.value?.engines || { ready: [], missing: [] })
const hasEngines = computed(() => engines.value.ready.length + engines.value.missing.length > 0)
const missingText = computed(() => listNames(engines.value.missing.map((e) => e.label)))
const missingSettings = computed(() => engines.value.missing.map((e) => e.setting).filter(Boolean))

const allowanceLabel = computed(() => (/prompt run/.test(summary.value?.allowance || '') ? 'Free prompt runs' : 'AI allowance'))

const help = computed(() => blockHelp(props.block))
const visible = computed(() => Boolean(summary.value && (summary.value.google || hasEngines.value || summary.value.allowance || props.block)))
</script>

<template>
  <section v-if="visible" class="ag-setup" aria-labelledby="ag-setup-title">
    <div class="ag-setup-head">
      <h2 id="ag-setup-title" class="ag-setup-title">Set up on this workspace</h2>
      <HelpTip :text="TIPS.agents.setup" label="About what is set up" />
    </div>

    <p v-if="block" class="ag-setup-block" role="status">
      <CircleAlert :size="14" aria-hidden="true" />
      <span class="ag-setup-block-text">
        <span class="ag-setup-block-title">{{ block.title }}</span>
        <span v-if="help" class="ag-setup-block-help">{{ help }}</span>
      </span>
      <AgButton size="xs" :loading="checking" class="ag-setup-retry" @click="emit('refresh')">Check again</AgButton>
    </p>

    <dl class="ag-setup-rows">
      <div v-if="summary.google" class="ag-setup-row">
        <dt>Google results</dt>
        <dd>
          <span :class="{ 'is-missing': !summary.google.configured }">{{ googleText }}</span>
          <span v-if="summary.google.setting" class="ag-setup-setting">Setting: {{ summary.google.setting }}.</span>
        </dd>
      </div>
      <div v-if="hasEngines" class="ag-setup-row">
        <dt>AI engines</dt>
        <dd>
          <span v-if="engines.ready.length">{{ listNames(engines.ready) }}</span>
          <span v-else class="is-missing">None set up</span>
          <span v-if="engines.missing.length && engines.ready.length" class="is-missing">Not set up: {{ missingText }}</span>
          <span v-if="missingSettings.length" class="ag-setup-setting">
            {{ missingSettings.length === 1 ? 'Setting' : 'Settings' }}: {{ missingSettings.join(', ') }}.
          </span>
        </dd>
      </div>
      <div v-if="summary.allowance" class="ag-setup-row">
        <dt>{{ allowanceLabel }}</dt>
        <dd class="ag-setup-num">{{ summary.allowance }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.ag-setup {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-setup-head {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ag-setup-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-setup-block {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--ag-warning);
  font-size: 13px;
  line-height: 19px;
}

.ag-setup-block > svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.ag-setup-block-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.ag-setup-block-help {
  color: var(--ag-fg-3);
}

.ag-setup-retry {
  flex-shrink: 0;
}

.ag-setup-rows {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0;
}

.ag-setup-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ag-setup-row dt {
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ag-setup-row dd {
  display: flex;
  flex-direction: column;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 19px;
}

.ag-setup-row .is-missing {
  color: var(--ag-fg-2);
}

.ag-setup-setting {
  color: var(--ag-fg-3);
  font-family: var(--ag-font-mono, ui-monospace, monospace);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.ag-setup-num {
  font-variant-numeric: tabular-nums;
}
</style>
