<template>
  <div class="rkp">
    <CardSkeleton v-if="phase === 'loading'" :height="240" />
    <div v-else-if="phase === 'failed'" class="rkp-state" role="alert">
      <p class="rkp-state-title">{{ failedTitle }}</p>
      <AgButton size="sm" @click="reload">Try again</AgButton>
    </div>
    <template v-else>
      <p class="rkp-headline">{{ headline }}</p>

      <div v-if="overCap" class="rkp-notice">
        <p class="rkp-notice-text">{{ overCap }}</p>
        <AgButton size="sm" variant="ghost" :to="{ name: 'billing' }">See plans</AgButton>
      </div>

      <div v-if="!prompts.length" class="rkp-state">
        <p class="rkp-state-title">Track a prompt first.</p>
        <AgButton size="sm" @click="board.open('prompts', { add: '1' })">Add prompts</AgButton>
      </div>
      <template v-else>
        <div class="rkp-order" role="radiogroup" :aria-labelledby="orderId">
          <span :id="orderId" class="rkp-order-label">Order</span>
          <label v-for="option in ORDERS" :key="option.value" class="rkp-order-item">
            <input
              type="radio"
              class="rkp-order-input"
              :name="orderId"
              :value="option.value"
              :checked="order === option.value"
              @change="setOrder(option.value)"
            />
            <span class="rkp-order-text">{{ option.label }}</span>
          </label>
        </div>

        <div class="rkp-scroll">
          <table class="rkp-table">
            <thead>
              <tr>
                <th scope="col" class="rkp-rank">Rank</th>
                <th scope="col" class="rkp-prompt">Prompt</th>
                <th scope="col">Named</th>
                <th scope="col" class="rkp-num">Answers</th>
                <th scope="col">Change</th>
                <th v-for="engine in engines" :key="engine.key" scope="col">{{ engine.label }}</th>
                <th scope="col">Google</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id" :class="{ 'is-waiting': !row.ranked }">
                <td class="rkp-rank" :class="{ 'is-word': !row.ranked }">{{ row.rank }}</td>
                <th scope="row" class="rkp-prompt">
                  <button type="button" class="rkp-open" @click="openPrompt(row.id)">{{ row.text }}</button>
                </th>
                <td :class="{ 'is-word': !row.answers }">{{ row.named }}</td>
                <td class="rkp-num">{{ row.answersText }}</td>
                <td :class="{ 'is-word': row.changeMissing }">{{ row.change }}</td>
                <td v-for="engine in engines" :key="engine.key" :class="{ 'is-word': !row.engines[engine.key].answered }">
                  {{ row.engines[engine.key].text }}
                </td>
                <td>{{ row.google }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <p class="rkp-foot">
        <span v-if="foot">{{ foot }}</span>
        <RouterLink class="rkp-link" :to="{ name: 'settings-autopilot' }">See Autopilot runs</RouterLink>
      </p>
    </template>
  </div>
</template>

<script setup>
// Prompt ranking's expanded view (autopilot_frontend.md 6f): the headline
// for the last 7 days against the 7 before, an order control (panel key
// `order`: best or weakest first) and every tracked prompt in a table, with
// its likely range, each engine's answers and its Google cell. Prompts with
// too few answers follow the ranked ones. A row opens the prompt.
import { computed, useId } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AgButton from '@/components/agent/common/AgButton.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import { widgetMeta } from '@/lib/board/widgets'
import {
  COPY,
  ORDERS,
  changeCell,
  engineCell,
  engineColumns,
  googleCell,
  namedCell,
  normalizeOrder,
  orderedRows,
  overCapLine,
  rankCell,
  rankingHeadline,
} from './specs'

defineProps({
  websiteId: { type: String, required: true },
})

const route = useRoute()
const router = useRouter()
const board = useBoard()
const { data, failure, stale, reload } = useBoardSource('ranking')

const orderId = `${useId()}-order`
const failedTitle = `We couldn't load ${widgetMeta('ranking')?.title || 'Prompt ranking'}.`

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const prompts = computed(() => (Array.isArray(data.value?.prompts) ? data.value.prompts : []))
const headline = computed(() => rankingHeadline(data.value?.headline))
const overCap = computed(() => overCapLine(data.value?.tracked))
const order = computed(() => normalizeOrder(route.query.order))
const engines = computed(() => engineColumns(prompts.value))

const rows = computed(() =>
  orderedRows(prompts.value, order.value).map((row) => ({
    id: String(row.prompt_id),
    text: row.text || '',
    ranked: Boolean(row.ranked),
    rank: rankCell(row),
    named: namedCell(row),
    answers: row.answers || 0,
    answersText: new Intl.NumberFormat('en-US').format(row.answers || 0),
    change: changeCell(row.change_pts),
    changeMissing: typeof row.change_pts !== 'number',
    engines: Object.fromEntries(
      engines.value.map((engine) => {
        const cell = row.engines?.[engine.key]
        return [engine.key, { text: engineCell(cell), answered: (cell?.answers || 0) > 0 }]
      }),
    ),
    google: googleCell(row.google),
  })),
)

const foot = computed(() =>
  [prompts.value.length ? COPY.shareFoot : '', stale.value ? COPY.staleNote : ''].filter(Boolean).join(' '),
)

// The order is the panel's own key: it stays on a project switch, like a filter.
function setOrder(value) {
  const query = { ...route.query }
  if (value === 'weakest') query.order = 'weakest'
  else delete query.order
  router.replace({ query, hash: route.hash }).catch(() => {})
}

function openPrompt(promptId) {
  board.open('prompts', { prompt: promptId })
}
</script>

<style scoped>
.rkp {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.rkp-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.rkp-state-title {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.rkp-headline {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
}

.rkp-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 8px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 10px;
}

.rkp-notice-text {
  flex: 1 1 240px;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.rkp-order {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.rkp-order-label {
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.rkp-order-item {
  position: relative;
  display: inline-flex;
}

.rkp-order-input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.rkp-order-text {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ag-seg-border);
  border-radius: 8px;
  background: var(--ag-seg-track);
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.rkp-order-input:checked + .rkp-order-text {
  background: var(--ag-seg-thumb);
  box-shadow: var(--ag-seg-thumb-shadow);
  color: var(--ag-fg-1);
}

.rkp-order-input:focus-visible + .rkp-order-text {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.rkp-scroll {
  overflow-x: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

.rkp-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}

.rkp-table th,
.rkp-table td {
  padding: 8px 10px 8px 0;
  border-bottom: 1px solid var(--ag-divider);
  text-align: left;
  vertical-align: top;
}

.rkp-table thead th {
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.rkp-table tbody th {
  font-weight: 400;
}

.rkp-rank {
  width: 1%;
  white-space: nowrap;
}

.rkp-table td.rkp-rank.is-word {
  min-width: 88px;
  white-space: normal;
}

.rkp-prompt {
  min-width: 180px;
}

.rkp-num {
  text-align: right;
}

.rkp-table td.rkp-num {
  text-align: right;
}

.is-word {
  color: var(--ag-fg-3);
}

.rkp-open {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rkp-open:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rkp-open:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.rkp-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.rkp-link {
  margin-left: auto;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rkp-link:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
