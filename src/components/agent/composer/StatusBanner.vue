<template>
  <div v-if="copy" class="ag-banner" :class="`is-${copy.tone}`" role="status">
    <component :is="copy.icon" class="ag-banner-icon" aria-hidden="true" />
    <div class="ag-banner-text">
      <p class="ag-banner-title">{{ copy.title }}</p>
      <p v-if="copy.body" class="ag-banner-body">{{ copy.body }}</p>
      <p v-if="copy.staff" class="ag-banner-body">{{ copy.staff }}</p>
    </div>
    <router-link v-if="copy.billing" class="ag-banner-action" to="/billing">See plans</router-link>
    <button v-else-if="copy.recheck" type="button" class="ag-banner-action" :disabled="checking" @click="emit('recheck')">
      {{ checking ? 'Checking' : 'Check again' }}
    </button>
  </div>
</template>

<script setup>
// Why the agent cannot answer right now, above the composer. Every state is
// a real server answer (status/ or a refused send), or says that status/
// could not be reached; nothing is guessed. When the agent cannot answer,
// it says what to do; staff and DEBUG or local builds also get the setting
// to change (lib/agent/setup.js).
import { computed } from 'vue'
import { CircleAlert, CirclePause, CloudOff, Gauge, PlugZap, Wrench } from '@lucide/vue'
import { agentFix } from '@/lib/agent/setup'
import { hidesUsd, meteredRuns, renewDate } from '@/lib/promptRuns'

const props = defineProps({
  // agent_disabled | agent_unavailable | maintenance | agent_not_configured | allowance_exceeded
  // | allowance_warning | prompt_runs_exhausted | status_unknown (status/ failed and nothing is known)
  code: { type: String, default: '' },
  allowance: { type: Object, default: null },
  // Why status/ failed, for status_unknown.
  detail: { type: String, default: '' },
  checking: { type: Boolean, default: false },
  // GET agent/status/, for the setting names the viewer may see.
  status: { type: Object, default: null },
})

const emit = defineEmits(['recheck'])

function usd(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Free accounts never see dollars (status allowance.show_usd false, or a
// metered prompt_runs block).
const free = computed(() => hidesUsd({ allowance: props.allowance, prompt_runs: props.status?.prompt_runs }))

const usage = computed(() => {
  if (free.value) return ''
  const spent = usd(props.allowance?.spent_usd)
  const cap = usd(props.allowance?.cap_usd)
  return spent && cap ? `${spent} of ${cap} used.` : ''
})

const copy = computed(() => {
  switch (props.code) {
    // Every agent endpoint but status/ refuses while it is off, so saved work
    // cannot be opened until then.
    case 'agent_disabled':
      return {
        tone: 'muted',
        icon: CirclePause,
        title: 'The agent is switched off.',
        body: 'It has been turned off on this server. Your chats and reports are kept and open again once it is back on.',
      }
    case 'status_unknown':
      return {
        tone: 'muted',
        icon: CloudOff,
        title: "We couldn't check the agent's status.",
        body: props.detail.trim(),
        recheck: true,
      }
    case 'agent_unavailable': {
      const fix = agentFix('agent_unavailable', props.status)
      return {
        tone: 'muted',
        icon: PlugZap,
        title: "The AI agent isn't running right now.",
        body: `Your chats are safe. A reply in progress continues when the agent is back, or shows as interrupted. ${fix.customer}`,
        staff: fix.staff,
        recheck: true,
      }
    }
    // nginx's maintenance switch, not the agent being down.
    case 'maintenance':
      return {
        tone: 'muted',
        icon: Wrench,
        title: 'CanSee is down for maintenance.',
        body: 'Your chats are safe. Try again in a few minutes.',
        recheck: true,
      }
    case 'agent_not_configured': {
      const fix = agentFix('agent_not_configured', props.status)
      return {
        tone: 'muted',
        icon: CircleAlert,
        title: "The AI agent isn't set up on this workspace.",
        body: `It needs an Anthropic API key to answer. ${fix.customer}`,
        staff: fix.staff,
      }
    }
    case 'allowance_exceeded':
      return free.value
        ? {
            tone: 'warning',
            icon: Gauge,
            title: "This month's free AI allowance is used up.",
            body: 'It renews next month. Upgrade your plan to keep working with the agent.',
            billing: true,
          }
        : {
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
        title: free.value ? "You are close to this month's free AI allowance." : 'You are close to your AI allowance.',
        body: usage.value,
        billing: true,
      }
    // Not blocking: the agent still answers, but asks no AI engine.
    case 'prompt_runs_exhausted': {
      const runs = meteredRuns(props.status?.prompt_runs)
      const date = renewDate(runs?.resetsAt)
      return {
        tone: 'warning',
        icon: Gauge,
        title: runs?.limit ? `You have used this month's ${runs.limit} free prompt runs.` : "This month's free prompt runs are used up.",
        body: `The agent still answers, but it can't ask the AI engines until they renew${date ? ` on ${date}` : ''}.`,
        billing: true,
      }
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
  border-radius: var(--radius);
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
  border-radius: var(--radius);
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
  border-radius: var(--radius);
}
</style>
