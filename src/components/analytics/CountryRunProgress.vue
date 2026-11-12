<script setup>
// The country check this view started or found running: progress while it
// runs (with Stop, confirmed first), then what it did and what it used,
// until dismissed. run: a CountryRun (contract 2f), polled by the page.
import { computed, ref } from 'vue'
import { CircleAlert, LoaderCircle } from '@lucide/vue'
import {
  AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay,
  AlertDialogPortal, AlertDialogRoot, AlertDialogTitle,
} from 'reka-ui'
import {
  COUNTRY_STATUS_TEXT, costLine, finishedChecks, isActiveRun, progressSummary, runTitle,
} from '@/lib/analytics/countrySpecs'
import { useHideUsd } from '@/composables/useHideUsd'
import { Button } from '@/components/ui/button'

const props = defineProps({
  run: { type: Object, required: true },
  stopping: { type: Boolean, default: false },
  cancelError: { type: String, default: '' },
})
const emit = defineEmits(['stop', 'dismiss'])

const confirmOpen = ref(false)

const active = computed(() => isActiveRun(props.run))
const isStopping = computed(() => active.value && (props.stopping || props.run.cancel_requested))
const total = computed(() => props.run.progress?.total || 0)
const finished = computed(() => Math.min(finishedChecks(props.run.progress), total.value))
const percent = computed(() => (total.value ? Math.round((finished.value / total.value) * 100) : 0))
const title = computed(() => runTitle(props.run))
const failedMessage = computed(() =>
  props.run.status === 'failed' && props.run.error?.message ? props.run.error.message : '',
)

function confirmStop() {
  confirmOpen.value = false
  emit('stop')
}

// Free accounts never see dollars.
const hideUsd = useHideUsd()
</script>

<template>
  <section class="crp" :class="{ 'is-active': active }" aria-labelledby="crp-title">
    <div class="crp-head">
      <div class="crp-head-text">
        <h2 id="crp-title" class="crp-title" aria-live="polite">{{ title }}</h2>
        <p v-if="failedMessage" class="crp-error">
          <CircleAlert class="crp-icon" aria-hidden="true" />
          <span>{{ failedMessage }}</span>
        </p>
      </div>
      <div class="crp-actions">
        <template v-if="active">
          <span v-if="isStopping" class="crp-stopping" role="status">
            <LoaderCircle class="crp-spin" aria-hidden="true" />
            Stopping...
          </span>
          <Button v-else variant="outline" size="sm" @click="confirmOpen = true">Stop</Button>
        </template>
        <Button v-else variant="ghost" size="sm" @click="emit('dismiss')">Dismiss</Button>
      </div>
    </div>

    <template v-if="active">
      <div
        class="crp-bar"
        role="progressbar"
        aria-label="Country check progress"
        aria-valuemin="0"
        :aria-valuemax="total"
        :aria-valuenow="finished"
        :aria-valuetext="`${finished} of ${total} checks`"
      >
        <span class="crp-fill" :style="{ width: `${percent}%` }"></span>
      </div>
      <p class="crp-count">{{ finished }} of {{ total }} checks</p>
      <ul class="crp-chips" aria-label="Countries">
        <li
          v-for="c in run.countries || []"
          :key="c.country"
          class="crp-chip"
          :class="`is-${c.status || 'queued'}`"
        >
          {{ c.name }} · {{ COUNTRY_STATUS_TEXT[c.status] || 'Waiting' }}
        </li>
      </ul>
    </template>
    <template v-else>
      <p class="crp-summary">{{ progressSummary(run.progress) }}</p>
      <p v-if="costLine(run, { hideUsd })" class="crp-cost">{{ costLine(run, { hideUsd }) }}</p>
    </template>

    <p v-if="cancelError" class="crp-error" role="alert">
      <CircleAlert class="crp-icon" aria-hidden="true" />
      <span>{{ cancelError }}</span>
    </p>

    <AlertDialogRoot v-model:open="confirmOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="crp-overlay" />
        <AlertDialogContent class="crp-confirm">
          <AlertDialogTitle class="crp-confirm-title">Stop this check?</AlertDialogTitle>
          <AlertDialogDescription class="crp-confirm-desc">
            Checks that already finished are kept. The rest are not run and not billed.
          </AlertDialogDescription>
          <div class="crp-confirm-actions">
            <AlertDialogCancel as-child>
              <Button variant="outline">Keep running</Button>
            </AlertDialogCancel>
            <AlertDialogAction as-child>
              <Button variant="destructive" @click="confirmStop">Stop</Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </section>
</template>

<style scoped>
.crp {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.crp.is-active {
  border-color: color-mix(in srgb, var(--gap-ai) 35%, var(--border));
}

.crp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.crp-head-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.crp-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.crp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.crp-stopping {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 500;
}

.crp-spin {
  width: 15px;
  height: 15px;
  animation: crp-spin 0.9s linear infinite;
}

@keyframes crp-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .crp-spin {
    animation: none;
  }
}

.crp-bar {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--muted);
}

.crp-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius);
  background: var(--gap-ai);
  transition: width 0.3s ease;
}

.crp-count,
.crp-summary {
  color: var(--foreground);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.crp-cost {
  color: var(--muted-foreground);
  font-size: 13px;
}

.crp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
}

.crp-chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--muted-foreground);
  font-size: 12.5px;
  font-weight: 500;
}

.crp-chip.is-running {
  border-color: var(--input);
  color: var(--foreground);
}

.crp-chip.is-done {
  background: var(--accent);
  color: var(--foreground);
}

.crp-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--destructive);
  font-size: 13px;
}

.crp-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.crp-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--scrim);
}

.crp-confirm {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  width: min(420px, calc(100vw - 32px));
  padding: 22px 24px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--popover);
  box-shadow: none;
  transform: translate(-50%, -50%);
  outline: none;
}

.crp-confirm-title {
  color: var(--foreground);
  font-size: 17px;
  font-weight: 600;
}

.crp-confirm-desc {
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.55;
}

.crp-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
</style>
