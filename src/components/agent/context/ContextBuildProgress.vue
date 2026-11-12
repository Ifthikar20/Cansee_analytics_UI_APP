<script setup>
// The context build this page started or found running: progress with Stop
// (confirmed first), then what it found and what it used, until dismissed.
// `run` is a context_build Run polled by the page's useInsightRun.
import { computed, ref } from 'vue'
import { CircleAlert } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { isActiveInsightRun } from '@/composables/analytics/useInsightRun'
import { durationText, money } from '@/lib/analytics/countrySpecs'
import { useHideUsd } from '@/composables/useHideUsd'

const props = defineProps({
  run: { type: Object, required: true },
  stopping: { type: Boolean, default: false },
  stopError: { type: String, default: '' },
})

const emit = defineEmits(['stop', 'dismiss'])

const integer = new Intl.NumberFormat('en-US')
const confirmOpen = ref(false)

const active = computed(() => isActiveInsightRun(props.run))
const isStopping = computed(() => active.value && (props.stopping || Boolean(props.run.cancel_requested)))
const progress = computed(() => props.run.progress || {})
const total = computed(() => Number(progress.value.total) || 0)
const settled = computed(() => {
  const p = progress.value
  return Math.min((p.done || 0) + (p.failed || 0) + (p.skipped || 0) + (p.cancelled || 0), total.value)
})
const percent = computed(() => (total.value ? Math.round((settled.value / total.value) * 100) : 0))
const result = computed(() => (props.run.result && typeof props.run.result === 'object' ? props.run.result : {}))
// A build without AI requests only re-checked the pages entries cite.
const recheckOnly = computed(() => Number(props.run.confirmed?.ai_calls ?? 1) === 0)

const title = computed(() => {
  const status = props.run.status
  if (active.value) return `Building context: ${integer.format(settled.value)} of ${integer.format(total.value)}`
  if (status === 'failed') return 'The build could not finish.'
  if (status === 'cancelled') return `Stopped after ${integer.format(settled.value)} of ${integer.format(total.value)}`
  if (status === 'interrupted') return `Interrupted after ${integer.format(settled.value)} of ${integer.format(total.value)}`
  if (recheckOnly.value) {
    const r = result.value.rechecked || {}
    const ok = Number(r.ok) || 0
    const changed = Number(r.changed) || 0
    const failed = Number(r.failed) || 0
    return `Re-checked ${integer.format(ok + changed + failed)} sources: ${integer.format(ok)} unchanged, ${integer.format(changed)} changed, ${integer.format(failed)} couldn't load.`
  }
  const suggested = Object.values(result.value.suggested || {}).reduce((sum, n) => sum + (Number(n) || 0), 0)
  const took = durationText(props.run.duration_ms)
  const what = `${integer.format(suggested)} ${suggested === 1 ? 'suggestion' : 'suggestions'} to review.`
  return took ? `Built in ${took}: ${what}` : what
})

const errorText = computed(() => (props.run.status === 'failed' ? props.run.error?.message || '' : ''))

// Free accounts never see dollars.
const hideUsd = useHideUsd()

const costLine = computed(() => {
  const ai = Number(props.run.cost?.ai_usd) || 0
  if (!(ai > 0)) return 'Nothing was billed.'
  return hideUsd.value ? "Used some of this month's free AI allowance." : `Used ${money(props.run.cost.ai_usd)} of AI allowance.`
})

function confirmStop() {
  confirmOpen.value = false
  emit('stop')
}
</script>

<template>
  <section class="ag-cbp" :class="{ 'is-active': active }" aria-label="Context build">
    <div class="ag-cbp-head">
      <p class="ag-cbp-title" aria-live="polite">{{ title }}</p>
      <div class="ag-cbp-actions">
        <template v-if="active">
          <span v-if="isStopping" class="ag-cbp-stopping" role="status">
            <AgSpinner :size="12" />
            Stopping...
          </span>
          <AgButton v-else size="xs" @click="confirmOpen = true">Stop</AgButton>
        </template>
        <AgButton v-else size="xs" variant="ghost" @click="emit('dismiss')">Dismiss</AgButton>
      </div>
    </div>

    <div
      v-if="active"
      class="ag-cbp-bar"
      role="progressbar"
      aria-label="Context build progress"
      aria-valuemin="0"
      :aria-valuemax="total"
      :aria-valuenow="settled"
      :aria-valuetext="`${settled} of ${total}`"
    >
      <span class="ag-cbp-fill" :style="{ width: `${percent}%` }" />
    </div>
    <template v-else>
      <p v-if="errorText" class="ag-cbp-error">
        <CircleAlert :size="14" aria-hidden="true" />
        <span>{{ errorText }}</span>
      </p>
      <p class="ag-cbp-cost">{{ costLine }}</p>
    </template>

    <p v-if="stopError" class="ag-cbp-error" role="alert">
      <CircleAlert :size="14" aria-hidden="true" />
      <span>{{ stopError }}</span>
    </p>

    <AgConfirmDialog
      v-model:open="confirmOpen"
      title="Stop this build?"
      description="Pages already read are kept. Nothing else is billed."
      confirm-label="Stop"
      cancel-label="Keep building"
      destructive
      @confirm="confirmStop"
    />
  </section>
</template>

<style scoped>
.ag-cbp {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  background: var(--ag-bubble-bg);
}

.ag-cbp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.ag-cbp-title {
  min-width: 0;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-cbp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ag-cbp-stopping {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ag-fg-3);
  font-size: 13px;
}

.ag-cbp-bar {
  overflow: hidden;
  height: 6px;
  border-radius: var(--radius);
  background: var(--ag-row-active);
}

.ag-cbp-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius);
  background: var(--ag-accent);
  transition: width 240ms ease;
}

.ag-cbp-cost {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-cbp-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

@media (prefers-reduced-motion: reduce) {
  .ag-cbp-fill {
    transition: none;
  }
}
</style>
