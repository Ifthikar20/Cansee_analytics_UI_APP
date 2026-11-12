<script setup>
// Asked and answered (board key "asked-answered"): the newest tracked
// prompt the engines have answered, set as a question, and under it one
// bar per engine for its latest answer: gray when the answer left you
// out, with the accent segment where it named you (further left the
// earlier you come), a hairline while the engine has not answered. The
// question opens that prompt in the panel. Reads the search-gap overview.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import { answerGap, answerSentence, askedAnswered, namedSummary, rowSentence, rowValue, youSegment } from '@/lib/board/d/askedAnswered'
import BlockFrame from './BlockFrame.vue'
import { NO_PROMPTS } from '../b/specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const board = useBoard()
const { data, error, failure, stale, reload } = useBoardSource('overview')

const block = computed(() => askedAnswered(data.value))
const empty = computed(() => (data.value && !block.value ? NO_PROMPTS : null))
const gap = computed(() => answerGap(block.value))
const summary = computed(() => namedSummary(block.value))
const sentence = computed(() => answerSentence(block.value))
const rows = computed(() => {
  const list = block.value?.rows || []
  const first = list.findIndex((row) => row.state === 'named')
  return list.map((row, i) => {
    const segment = youSegment(row)
    return {
      ...row,
      value: rowValue(row),
      sentence: rowSentence(row),
      tagged: i === first,
      segment: segment ? { left: `${segment.left}%`, width: `${segment.width}%` } : null,
    }
  })
})
const foot = computed(() => {
  if (!block.value?.answered) return ''
  return block.value.newest ? 'Your newest prompt. Latest answers.' : 'Your newest prompt with answers.'
})

function openPrompt() {
  if (block.value?.id) board.open('prompts', { prompt: block.value.id })
  else board.open('prompts')
}
</script>

<template>
  <BlockFrame
    widget="asked-answered"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    :gap="gap ? gap.kind : ''"
    :foot="foot"
    :skeleton="280"
    @retry="reload"
  >
    <div v-if="block" class="wd-qa">
      <div class="wd-qa-part">
        <p class="wd-qa-label cs-label">
          <span>Asked</span>
          <span v-if="block.location"><span class="sr-only">Location </span>{{ block.location }}</span>
        </p>
        <h3 class="wd-qa-question cs-title">
          <button type="button" class="wd-qa-open" @click="openPrompt">{{ block.text }}</button>
        </h3>
      </div>

      <div class="wd-qa-part">
        <p class="wd-qa-label cs-label">
          <span>Answered</span>
          <span v-if="summary" class="cs-label--signal" aria-hidden="true">{{ summary }}</span>
        </p>
        <p v-if="gap" class="wd-qa-gap">{{ gap.title }}</p>
        <template v-else>
          <p class="sr-only">{{ sentence }}</p>
          <ul class="wd-qa-rows" role="list">
            <li v-for="row in rows" :key="row.key" class="wd-qa-row" :class="`is-${row.state}`">
              <span class="sr-only">{{ row.sentence }}</span>
              <span class="wd-qa-engine" aria-hidden="true">{{ row.label }}</span>
              <span class="wd-qa-track" aria-hidden="true">
                <span v-if="row.segment" class="wd-qa-you" :style="row.segment">
                  <span v-if="row.tagged" class="wd-qa-tag">You</span>
                </span>
              </span>
              <span class="wd-qa-value" aria-hidden="true">{{ row.value }}</span>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </BlockFrame>
</template>

<style scoped>
.wd-qa {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 32px;
  min-width: 0;
}

.wd-qa-part {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.wd-qa-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  font-size: 11px;
  white-space: nowrap;
}

/* The question, in the board's display type: it grows with the card and
   stops at four lines (the whole question is the button's own text). */
.wd-qa-question {
  margin: 0;
  font-size: clamp(22px, 8cqi, 34px);
  text-wrap: balance;
}

.wd-qa-open {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.wd-qa-open:hover {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.wd-qa-open:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.wd-qa-gap {
  max-width: 34ch;
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 18px;
}

/* One grid for every row, so engines, bars and values line up. The first
   row leaves room above its bar for the "You" tag. */
.wd-qa-rows {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  align-items: center;
  gap: 14px 12px;
  margin: 0;
  padding: 12px 0 0;
  list-style: none;
}

.wd-qa-row {
  display: contents;
}

.wd-qa-engine,
.wd-qa-value {
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.wd-qa-engine {
  color: var(--foreground);
}

.wd-qa-value {
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.wd-qa-row.is-named .wd-qa-value {
  color: var(--foreground);
}

.wd-qa-track {
  position: relative;
  display: block;
  height: 10px;
  background: var(--bar);
}

/* Set up, no answer yet: a hairline where the bar will be. */
.wd-qa-row.is-waiting .wd-qa-track {
  height: 1px;
  background: var(--rule-strong);
  opacity: 0.35;
}

.wd-qa-you {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--signal);
}

.wd-qa-tag {
  position: absolute;
  bottom: calc(100% + 3px);
  left: 0;
  color: var(--signal-text);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* A wide card sets the question beside its answers. */
@container wd-block (min-width: 560px) {
  .wd-qa {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 40px;
  }

  .wd-qa-question {
    font-size: clamp(24px, 5cqi, 40px);
  }

  .wd-qa-rows {
    row-gap: 18px;
  }
}
</style>
