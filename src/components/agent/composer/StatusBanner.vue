<template>
  <div v-if="copy" class="ag-banner" :class="`is-${copy.tone}`" role="status">
    <component :is="copy.icon" class="ag-banner-icon" aria-hidden="true" />
    <div class="ag-banner-text">
      <p class="ag-banner-title">{{ copy.title }}</p>
      <p v-if="copy.body" class="ag-banner-body">{{ copy.body }}</p>
    </div>
    <router-link v-if="copy.billing" class="ag-banner-action" to="/billing">See plans</router-link>
    <button v-else-if="copy.recheck" type="button" class="ag-banner-action" :disabled="checking" @click="emit('recheck')">
      {{ checking ? 'Checking' : 'Check again' }}
    </button>
  </div>
</template>

<script setup>
// Why the agent cannot answer right now, above the composer. Every state is
// a real server answer (status/ or a refused send); nothing is guessed.
import { computed } from 'vue'
import { CircleAlert, CirclePause, Gauge, PlugZap } from '@lucide/vue'

const props = defineProps({
  // agent_disabled | agent_unavailable | agent_not_configured | allowance_exceeded | allowance_warning
  code: { type: String, default: '' },
  allowance: { type: Object, default: null },
  checking: { type: Boolean, default: false },
})

const emit = defineEmits(['recheck'])

function usd(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const usage = computed(() => {
  const spent = usd(props.allowance?.spent_usd)
  const cap = usd(props.allowance?.cap_usd)
  return spent && cap ? `${spent} of ${cap} used.` : ''
})

const copy = computed(() => {
  switch (props.code) {
    case 'agent_disabled':
      return {
        tone: 'muted',
        icon: CirclePause,
        title: 'The agent is switched off.',
        body: 'It has been turned off on this server. Your chats and reports are still here.',
      }
    case 'agent_unavailable':
      return {
        tone: 'muted',
        icon: PlugZap,
        title: "The agent service isn't reachable right now.",
        body: 'Your chats are safe. Try again in a minute.',
        recheck: true,
      }
    case 'agent_not_configured':
      return {
        tone: 'muted',
        icon: CircleAlert,
        title: "The agent isn't set up on this server yet.",
        body: 'No Anthropic API key is configured, so it cannot answer.',
      }
    case 'allowance_exceeded':
      return {
        tone: 'warning',
        icon: Gauge,
        title: "You've used your AI allowance for this period.",
        body: [usage.value, 'Upgrade your plan to keep working with the agent.'].filter(Boolean).join(' '),
        billing: true,
      }
    case 'allowance_warning':
      return {
        tone: 'warning',
        icon: Gauge,
        title: 'You are close to your AI allowance.',
        body: usage.value,
        billing: true,
      }
    default:
      return null
  }
})
</script>

<style scoped>
.ag-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: var(--ag-composer-bg);
}

.ag-banner-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--ag-fg-3);
}

.ag-banner.is-warning .ag-banner-icon {
  color: var(--ag-warning);
}

.ag-banner-text {
  flex: 1;
  min-width: 0;
}

.ag-banner-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-banner-body {
  margin: 2px 0 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.ag-banner-action {
  flex-shrink: 0;
  align-self: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 8px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 26px;
  white-space: nowrap;
  cursor: pointer;
}

.ag-banner-action:hover:not(:disabled) {
  background: var(--ag-btn-hover);
  opacity: 1;
}

.ag-banner-action:disabled {
  color: var(--ag-fg-3);
  cursor: default;
}

.ag-banner-action:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
