<template>
  <!-- The project's recent Autopilot runs (autopilot_frontend.md 2b, contract
       3c RunSummary). A run that has not started yet has measured nothing:
       its numbers read as a dash next to its status word. -->
  <div class="art">
    <div class="art-head">
      <Button size="sm" class="art-btn" :disabled="!canRun" @click="emit('run-now')">Run now</Button>
    </div>

    <div v-if="runs.length" class="art-scroll" role="region" aria-label="Autopilot runs" tabindex="0">
      <table class="art-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col" class="is-num">Prompts</th>
            <th scope="col" class="is-num">Named</th>
            <th scope="col" class="is-num">AI cost</th>
            <th scope="col" class="is-num">Google pages</th>
            <th scope="col">Text</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id">
            <td class="art-nowrap">{{ shortDate(run.local_date) }}</td>
            <td>
              <div class="art-status">
                <span>{{ runStatusWord(run.status) }}</span>
                <Button
                  v-if="run.status === 'running'"
                  size="sm"
                  variant="outline"
                  class="art-stop"
                  :disabled="stopping === run.id"
                  @click="emit('stop', run)"
                >Stop</Button>
              </div>
              <p v-if="errorOf(run)" class="art-error">{{ errorOf(run) }}</p>
            </td>
            <td class="is-num">{{ promptsCell(run) }}</td>
            <td class="is-num">{{ namedCell(run) }}</td>
            <td class="is-num">{{ costCell(run) }}</td>
            <td class="is-num">{{ pagesCell(run) }}</td>
            <td class="art-text">{{ textStatusLine(run.text, timezone) || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { Button } from '@/components/ui/button'
import { count, runStatusWord, shortDate, textStatusLine, usd } from '@/lib/autopilot/format'

defineProps({
  // RunSummary rows, newest first.
  runs: { type: Array, default: () => [] },
  // The project's time zone (the text's times).
  timezone: { type: String, default: 'UTC' },
  // The id of the run being stopped.
  stopping: { type: String, default: null },
  canRun: { type: Boolean, default: true },
})
const emit = defineEmits(['run-now', 'stop'])

// Nothing is measured before a run starts.
const notStarted = (run) => run.status === 'queued'

function promptsCell(run) {
  if (notStarted(run)) return '—'
  const p = run.prompts || {}
  return `${count(p.done)} of ${count(p.planned)}`
}

function namedCell(run) {
  if (notStarted(run)) return '—'
  const a = run.answers || {}
  if (!Number(a.answered)) return 'No answers'
  return `${count(a.named)} of ${count(a.answered)}`
}

function costCell(run) {
  if (notStarted(run)) return '—'
  return usd(run.cost?.ai_usd) || '—'
}

function pagesCell(run) {
  if (notStarted(run)) return '—'
  const pages = run.google?.pages
  return pages === null || pages === undefined ? '—' : count(pages)
}

// Why a run failed or was skipped, in the server's words.
function errorOf(run) {
  if (run.status !== 'failed' && run.status !== 'skipped') return ''
  return run.error?.message || ''
}
</script>

<style scoped>
.art {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.art-head {
  display: flex;
  justify-content: flex-end;
}

.art-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius);
  font-size: 13px;
}

.art-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.art-scroll:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.art-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13px;
}

.art-table th {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.art-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  vertical-align: top;
}

.art-table tbody tr:last-child td {
  border-bottom: 0;
}

.art-table .is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.art-nowrap {
  white-space: nowrap;
}

.art-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.art-stop {
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius);
  font-size: 12px;
}

.art-error {
  margin: 4px 0 0;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.45;
}

.art-text {
  min-width: 180px;
  color: var(--muted-foreground);
  line-height: 1.45;
}
</style>
