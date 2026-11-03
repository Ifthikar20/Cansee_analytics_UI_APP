<script setup>
// The insights run this view started or found running (p2_contract.md 1e,
// frontend 1b): progress while it runs, with Stop (confirmed first), then
// what it did and what it used, until dismissed. run: a Run, polled by the
// page's useInsightRun.
import { computed, ref, useId } from 'vue'
import { CircleAlert, LoaderCircle } from '@lucide/vue'
import {
  AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay,
  AlertDialogPortal, AlertDialogRoot, AlertDialogTitle,
} from 'reka-ui'
import { isActiveInsightRun } from '@/composables/analytics/useInsightRun'
import { durationText, money, progressSummary } from '@/lib/analytics/countrySpecs'
import { RUN_KIND_LABELS } from '@/lib/analytics/insightWords'
import { Button } from '@/components/ui/button'

const props = defineProps({
  run: { type: Object, required: true },
  // Stop was asked and the server has not answered yet.
  stopping: { type: Boolean, default: false },
  stopError: { type: String, default: '' },
})
const emit = defineEmits(['stop', 'dismiss'])

const integer = new Intl.NumberFormat('en-US')
const confirmOpen = ref(false)
const titleId = useId()

const active = computed(() => isActiveInsightRun(props.run))
const isStopping = computed(() => active.value && (props.stopping || Boolean(props.run.cancel_requested)))
const label = computed(() => props.run.kind_label || RUN_KIND_LABELS[props.run.kind] || 'Run')
const progress = computed(() => props.run.progress || {})
const total = computed(() => Number(progress.value.total) || 0)
// Items that came to an end in any way, for the bar.
const settled = computed(() => {
  const p = progress.value
  return Math.min((p.done || 0) + (p.failed || 0) + (p.skipped || 0) + (p.cancelled || 0), total.value)
})
const percent = computed(() => (total.value ? Math.round((settled.value / total.value) * 100) : 0))

// Items that ran before a stop or an interruption. Items the sweep closed
// as interrupted end failed and never finished, so an interrupted run
// counts only what was done.
const ran = computed(() => {
  const p = progress.value
  if (props.run.status === 'interrupted') return p.done || 0
  return (p.done || 0) + (p.failed || 0) + (p.skipped || 0)
})

const title = computed(() => {
  switch (props.run.status) {
    case 'queued':
    case 'running':
      return `${label.value} running`
    case 'cancelled':
      return `Stopped after ${integer.format(ran.value)} of ${integer.format(total.value)}`
    case 'interrupted':
      return `Interrupted after ${integer.format(ran.value)} of ${integer.format(total.value)}`
    case 'failed':
      return 'The run could not finish'
    default: {
      const took = durationText(props.run.duration_ms)
      return took ? `${label.value} finished in ${took}` : `${label.value} finished`
    }
  }
})

const failedMessage = computed(() => (props.run.status === 'failed' ? props.run.error?.message || '' : ''))

const costLine = computed(() => {
  const cost = props.run.cost || {}
  const ai = Number(cost.ai_usd) || 0
  const pages = Number(cost.google_pages) || 0
  if (!ai && !pages) return 'Nothing was billed.'
  let line = `Used ${money(cost.ai_usd)} of AI allowance`
  if (pages) {
    const used = `${integer.format(pages)} Google ${pages === 1 ? 'page' : 'pages'}`
    line +=
      typeof cost.scraperapi_credits === 'number'
        ? ` and ${used} (about ${integer.format(cost.scraperapi_credits)} ScraperAPI credits)`
        : ` and ${used}`
  }
  return `${line}.`
})

function confirmStop() {
  confirmOpen.value = false
  emit('stop')
}
</script>

<template>
  <section class="irp" :class="{ 'is-active': active }" :aria-labelledby="titleId">
    <div class="irp-head">
      <div class="irp-head-text">
        <h2 :id="titleId" class="irp-title" aria-live="polite">{{ title }}</h2>
        <p v-if="failedMessage" class="irp-error">
          <CircleAlert class="irp-icon" aria-hidden="true" />
          <span>{{ failedMessage }}</span>
        </p>
      </div>
      <div class="irp-actions">
        <template v-if="active">
          <span v-if="isStopping" class="irp-stopping" role="status">
            <LoaderCircle class="irp-spin" aria-hidden="true" />
            Stopping...
          </span>
          <Button v-else variant="outline" size="sm" class="rounded-full" @click="confirmOpen = true">Stop</Button>
        </template>
        <Button v-else variant="ghost" size="sm" class="rounded-full" @click="emit('dismiss')">Dismiss</Button>
      </div>
    </div>

    <template v-if="active">
      <div
        class="irp-bar"
        role="progressbar"
        :aria-label="`${label} progress`"
        aria-valuemin="0"
        :aria-valuemax="total"
        :aria-valuenow="settled"
        :aria-valuetext="`${settled} of ${total}`"
      >
        <span class="irp-fill" :style="{ width: `${percent}%` }"></span>
      </div>
      <p class="irp-count">{{ integer.format(settled) }} of {{ integer.format(total) }}</p>
    </template>
    <template v-else>
      <p class="irp-summary">{{ progressSummary(run.progress) }}</p>
      <p class="irp-cost">{{ costLine }}</p>
    </template>

    <p v-if="stopError" class="irp-error" role="alert">
      <CircleAlert class="irp-icon" aria-hidden="true" />
      <span>{{ stopError }}</span>
    </p>

    <AlertDialogRoot v-model:open="confirmOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="irp-overlay" />
        <AlertDialogContent class="irp-confirm">
          <AlertDialogTitle class="irp-confirm-title">Stop this run?</AlertDialogTitle>
          <AlertDialogDescription class="irp-confirm-desc">
            Work that already finished is kept. The rest is not run and not billed.
          </AlertDialogDescription>
          <div class="irp-confirm-actions">
            <AlertDialogCancel as-child>
              <Button variant="outline" class="rounded-full">Keep running</Button>
            </AlertDialogCancel>
            <AlertDialogAction as-child>
              <Button variant="destructive" class="rounded-full" @click="confirmStop">Stop</Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </section>
</template>

<style scoped>
.irp {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.irp.is-active {
  border-color: color-mix(in srgb, var(--gap-ai) 35%, var(--border));
}

.irp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.irp-head-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.irp-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.irp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.irp-stopping {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 500;
}

.irp-spin {
  width: 15px;
  height: 15px;
  animation: irp-spin 0.9s linear infinite;
}

@keyframes irp-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .irp-spin {
    animation: none;
  }
}

.irp-bar {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--muted);
}

.irp-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: var(--gap-ai);
  transition: width 0.3s ease;
}

.irp-count,
.irp-summary {
  color: var(--foreground);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.irp-cost {
  color: var(--muted-foreground);
  font-size: 13px;
}

.irp-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--destructive);
  font-size: 13px;
}

.irp-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.irp-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 10, 12, 0.45);
}

.irp-confirm {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  width: min(420px, calc(100vw - 32px));
  padding: 22px 24px 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--popover);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%);
  outline: none;
}

.irp-confirm-title {
  color: var(--foreground);
  font-size: 17px;
  font-weight: 600;
}

.irp-confirm-desc {
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.55;
}

.irp-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
