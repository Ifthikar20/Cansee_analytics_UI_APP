<script setup>
// Recent country checks (contract 2f RunSummary, newest first): when, which
// countries, how each ended, and what it used.
import { CircleCheck, CircleMinus, CirclePause, CircleStop, CircleX, LoaderCircle } from '@lucide/vue'
import { RUN_STATUS_TEXT, costLine, finishedChecks, isActiveRun } from '@/lib/analytics/countrySpecs'
import { useHideUsd } from '@/composables/useHideUsd'

defineProps({
  runs: { type: Array, default: () => [] },
})

// A check still going counts every check that has finished, as its progress
// panel does; one that ended counts the checks that were done.
function checksDone(run) {
  return isActiveRun(run) ? finishedChecks(run.progress) : run.progress?.done || 0
}

const ICONS = {
  queued: LoaderCircle,
  running: LoaderCircle,
  done: CircleCheck,
  partial: CircleMinus,
  failed: CircleX,
  cancelled: CircleStop,
  interrupted: CirclePause,
}

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function dateText(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : when.format(d)
}

// Free accounts never see dollars.
const hideUsd = useHideUsd()
</script>

<template>
  <p v-if="!runs.length" class="rr-empty">No checks yet.</p>
  <ul v-else class="rr">
    <li v-for="run in runs" :key="run.id" class="rr-item">
      <div class="rr-top">
        <time class="rr-date" :datetime="run.created_at">{{ dateText(run.created_at) }}</time>
        <span class="rr-status" :class="`is-${run.status}`">
          <component :is="ICONS[run.status] || CircleMinus" class="rr-icon" aria-hidden="true" />
          {{ RUN_STATUS_TEXT[run.status] || run.status }}
        </span>
      </div>
      <ul class="rr-countries" aria-label="Countries">
        <li v-for="c in run.countries || []" :key="c.country" class="rr-chip">{{ c.name }}</li>
      </ul>
      <p class="rr-line">
        {{ checksDone(run) }} of {{ run.progress?.total || 0 }} checks
        <template v-if="costLine(run, { hideUsd })">
          <span class="rr-sep" aria-hidden="true">·</span>
          <span class="rr-cost">{{ costLine(run, { hideUsd }) }}</span>
        </template>
      </p>
      <p v-if="run.created_by_name" class="rr-by">By {{ run.created_by_name }}</p>
    </li>
  </ul>
</template>

<style scoped>
.rr-empty {
  padding: 18px 4px;
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.rr {
  display: grid;
  list-style: none;
}

.rr-item {
  display: grid;
  gap: 6px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.rr-item:first-child {
  padding-top: 0;
}

.rr-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.rr-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rr-date {
  color: var(--foreground);
  font-size: 13.5px;
  font-weight: 600;
}

.rr-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
}

.rr-status.is-failed,
.rr-status.is-interrupted {
  color: var(--destructive);
}

.rr-status.is-cancelled,
.rr-status.is-partial {
  color: var(--muted-foreground);
}

.rr-icon {
  width: 15px;
  height: 15px;
}

.rr-countries {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
}

.rr-chip {
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--foreground);
  font-size: 12px;
  font-weight: 500;
}

.rr-line {
  color: var(--foreground);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.rr-sep {
  margin: 0 6px;
  color: var(--muted-foreground);
}

.rr-cost,
.rr-by {
  color: var(--muted-foreground);
  font-size: 12.5px;
}
</style>
