<script setup>
// One product's latest results (contract 9 ProductDetail), in a sheet from
// the right (full screen on phones): per shopping question, what Google
// Shopping listed and what each engine answered, then the history of
// checks. Prices are the strings Google showed, never converted.
import { computed, ref, watch } from 'vue'
import { CircleAlert, X } from '@lucide/vue'
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import insightsApi from '@/api/insights'
import { engineStateWord, shoppingText } from '@/lib/analytics/productSpecs'
import { formatDateLabel } from '@/lib/charts/format'
import { engineMeta } from '@/lib/engines'
import { timeAgo } from '@/utils/timeAgo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  websiteId: { type: String, required: true },
  productId: { type: String, default: '' },
  // The list row, shown while the detail loads.
  product: { type: Object, default: null },
})

const integer = new Intl.NumberFormat('en-US')

const detail = ref(null)
const loading = ref(false)
const failed = ref(false)
let token = 0

async function load() {
  const id = props.productId
  if (!id) return
  const mine = ++token
  loading.value = true
  failed.value = false
  try {
    const res = await insightsApi.product(props.websiteId, id)
    if (mine !== token) return
    detail.value = res.data
  } catch {
    if (mine === token) failed.value = true
  } finally {
    if (mine === token) loading.value = false
  }
}

watch(
  () => [open.value, props.productId],
  ([isOpen, id], before) => {
    if (!isOpen || !id) return
    if (!before || before[1] !== id || !before[0]) {
      detail.value = null
      load()
    }
  },
  { immediate: true },
)

const shown = computed(() => detail.value || props.product)
const title = computed(() => shown.value?.name || '')
const matchWords = computed(() => (shown.value?.match_terms || []).join(', '))

// The show-answer toggles, by "question|engine".
const openAnswers = ref(new Set())

function toggleAnswer(key) {
  const next = new Set(openAnswers.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openAnswers.value = next
}

function googleLine(google) {
  if (!google || google.state === 'not_checked') return null
  return shoppingText(google)
}

function engineName(e) {
  return e.label || engineMeta(e.key).label
}

// "#2" when the answer named it in a numbered list; the state word "Named"
// already says the rest.
function rankText(e) {
  return e.state === 'named' && typeof e.rank === 'number' ? `#${e.rank}` : ''
}

function historyEngines(h) {
  if (!(h.engines_answers > 0)) return 'Not checked'
  return `${integer.format(h.engines_named || 0)} of ${integer.format(h.engines_answers)}`
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="pds-overlay" />
      <DialogContent class="pds">
        <div class="pds-head">
          <div class="pds-head-text">
            <DialogTitle class="pds-title">{{ title }}</DialogTitle>
            <DialogDescription class="pds-desc">{{ matchWords }}</DialogDescription>
          </div>
          <DialogClose class="pds-close" aria-label="Close">
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <div class="pds-body">
          <div v-if="loading && !detail" class="pds-loading" aria-busy="true" aria-label="Loading this product">
            <Skeleton class="h-5 w-2/3 rounded" />
            <Skeleton class="h-40 rounded-xl" />
            <Skeleton class="h-32 rounded-xl" />
          </div>

          <div v-else-if="failed && !detail" class="pds-failed">
            <p class="pds-muted">We couldn't load this product.</p>
            <Button variant="outline" size="sm" class="rounded-full" @click="load">Try again</Button>
          </div>

          <template v-else-if="detail">
            <section
              v-for="(q, qi) in detail.queries || []"
              :key="q.query"
              class="pds-question"
              :aria-labelledby="`pds-q-${qi}`"
            >
              <h3 :id="`pds-q-${qi}`" class="pds-q-title">{{ q.query }}</h3>

              <div class="pds-block">
                <h4 class="pds-block-title">Google Shopping</h4>
                <p v-if="!q.google || q.google.state === 'not_checked'" class="pds-muted">Not checked yet</p>
                <p v-else-if="q.google.state === 'failed'" class="pds-error">
                  <CircleAlert class="pds-icon" aria-hidden="true" />
                  <span>{{ q.google.error?.message || 'Google search failed.' }}</span>
                </p>
                <template v-else>
                  <p class="pds-line">
                    <span class="pds-strong">{{ googleLine(q.google).text }}</span>
                    <span v-if="googleLine(q.google).sub"> {{ googleLine(q.google).sub }}</span>
                    <span v-if="q.google.checked_at" class="pds-muted"> · Checked {{ timeAgo(q.google.checked_at) }}</span>
                  </p>

                  <div v-if="(q.google.matches || []).length" class="pds-table-wrap">
                    <table class="pds-table">
                      <caption class="pds-caption">Matches</caption>
                      <thead>
                        <tr>
                          <th scope="col" class="is-num">Position</th>
                          <th scope="col">Title</th>
                          <th scope="col">Seller</th>
                          <th scope="col" class="is-num">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="m in q.google.matches" :key="`${m.position}-${m.title}`">
                          <td class="is-num">#{{ m.position }}</td>
                          <th scope="row">{{ m.title }}</th>
                          <td>
                            {{ m.seller }}
                            <span v-if="m.sold_by_you" class="pds-badge">Sold by you</span>
                          </td>
                          <td class="is-num">{{ m.price }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p v-if="q.google.lowest" class="pds-line">
                    Lowest listed: {{ q.google.lowest.price }} from {{ q.google.lowest.seller }}
                  </p>

                  <div v-if="(q.google.top || []).length" class="pds-table-wrap">
                    <table class="pds-table">
                      <caption class="pds-caption">Top results</caption>
                      <thead>
                        <tr>
                          <th scope="col" class="is-num">Position</th>
                          <th scope="col">Title</th>
                          <th scope="col">Seller</th>
                          <th scope="col" class="is-num">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="r in q.google.top" :key="`${r.position}-${r.title}`" :class="{ 'is-match': r.is_match }">
                          <td class="is-num">#{{ r.position }}</td>
                          <th scope="row">
                            {{ r.title }}
                            <span v-if="r.is_match" class="pds-badge">Yours</span>
                          </th>
                          <td>{{ r.seller }}</td>
                          <td class="is-num">{{ r.price }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
              </div>

              <div class="pds-block">
                <h4 class="pds-block-title">AI engines</h4>
                <p v-if="!(q.engines || []).length" class="pds-muted">Not checked yet</p>
                <ul v-else class="pds-engines">
                  <li v-for="e in q.engines" :key="e.key" class="pds-engine">
                    <p class="pds-engine-head">
                      <span class="pds-strong">{{ engineName(e) }}</span>
                      <span v-if="e.state === 'not_checked'" class="pds-muted">Not checked yet</span>
                      <template v-else>
                        <span :class="{ 'pds-muted': e.state !== 'named' }">{{ engineStateWord(e.state) }}</span>
                        <span v-if="rankText(e)" class="pds-strong">{{ rankText(e) }}</span>
                      </template>
                    </p>
                    <p v-if="e.state === 'failed'" class="pds-error">
                      <CircleAlert class="pds-icon" aria-hidden="true" />
                      <span>{{ e.error?.message || 'The engine returned an error.' }}</span>
                    </p>
                    <p v-if="e.excerpt" class="pds-excerpt">{{ e.excerpt }}</p>
                    <template v-if="e.answer_text">
                      <button
                        type="button"
                        class="pds-link"
                        :aria-expanded="openAnswers.has(`${q.query}|${e.key}`) ? 'true' : 'false'"
                        @click="toggleAnswer(`${q.query}|${e.key}`)"
                      >Show answer</button>
                      <p v-if="openAnswers.has(`${q.query}|${e.key}`)" class="pds-answer">{{ e.answer_text }}</p>
                    </template>
                  </li>
                </ul>
              </div>
            </section>

            <section class="pds-question" aria-labelledby="pds-history">
              <h3 id="pds-history" class="pds-q-title">History</h3>
              <p v-if="!(detail.history || []).length" class="pds-muted">Not checked yet</p>
              <div v-else class="pds-table-wrap">
                <table class="pds-table">
                  <caption class="sr-only">History</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col" class="is-num">Best Google position</th>
                      <th scope="col" class="is-num">Engine answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="h in detail.history" :key="h.checked_at">
                      <th scope="row">{{ formatDateLabel(h.checked_at, 'day') }}</th>
                      <td class="is-num">
                        {{ typeof h.google_best_position === 'number' ? `#${h.google_best_position}` : 'No position' }}
                      </td>
                      <td class="is-num">{{ historyEngines(h) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.pds-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 10, 12, 0.45);
}

.pds {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 61;
  display: flex;
  flex-direction: column;
  width: min(600px, 100vw);
  height: 100dvh;
  border-left: 1px solid var(--border);
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: -24px 0 64px rgba(0, 0, 0, 0.16);
  outline: none;
}

.pds-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 24px 14px;
  border-bottom: 1px solid var(--border);
}

.pds-head-text {
  min-width: 0;
}

.pds-title {
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.pds-desc {
  margin-top: 4px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.pds-close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
}

.pds-close:hover {
  background: var(--accent);
  color: var(--foreground);
}

.pds-body {
  display: grid;
  align-content: start;
  gap: 22px;
  min-height: 0;
  padding: 18px 24px 28px;
  overflow-y: auto;
}

.pds-loading {
  display: grid;
  gap: 12px;
}

.pds-failed {
  display: grid;
  justify-items: start;
  gap: 10px;
}

.pds-question {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.pds-q-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.pds-block {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--card);
}

.pds-block-title {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pds-line {
  color: var(--foreground);
  font-size: 13.5px;
}

.pds-strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pds-muted {
  color: var(--muted-foreground);
  font-size: 13.5px;
}

.pds-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--destructive);
  font-size: 13px;
}

.pds-icon {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 2px;
}

.pds-table-wrap {
  overflow-x: auto;
}

.pds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.pds-caption {
  padding-bottom: 6px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}

.pds-table th,
.pds-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.pds-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.pds-table tbody th {
  font-weight: 500;
}

.pds-table tbody tr:last-child > * {
  border-bottom: 0;
}

.pds-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.pds-table tr.is-match > * {
  background: var(--muted);
}

.pds-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--foreground);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.pds-engines {
  display: grid;
  gap: 12px;
  list-style: none;
}

.pds-engine {
  display: grid;
  gap: 4px;
}

.pds-engine-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 13.5px;
}

.pds-excerpt {
  color: var(--foreground);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.pds-link {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12.5px;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.pds-link:hover {
  color: var(--foreground);
}

.pds-answer {
  max-height: 320px;
  padding: 10px 12px;
  overflow-y: auto;
  border-radius: 10px;
  background: var(--muted);
  color: var(--foreground);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  .pds {
    width: 100vw;
    border-left: 0;
  }
  .pds-head,
  .pds-body {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
