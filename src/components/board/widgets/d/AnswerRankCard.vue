<script setup>
// Rank in AI answers (board key "answer-rank"): the brands the engines
// name in each prompt's latest answers, as numbered rows with a bar for
// the share of answers naming each. Your row wears the accent square and
// the ink bar; when you rank below the rows shown it takes the last one,
// with its real place. The overview carries no earlier ranking, so no
// movement is shown. Reads the search-gap overview's leaderboard.
import { computed } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { rankRows, rowSentence, yourPlace } from '@/lib/board/d/answerRank'
import BlockFrame from './BlockFrame.vue'
import { NO_PROMPTS } from '../b/specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const { data, error, failure, stale, reload } = useBoardSource('overview')

const rows = computed(() => rankRows(data.value?.leaderboard).map((row) => ({ ...row, sentence: rowSentence(row) })))
const place = computed(() => yourPlace(data.value?.leaderboard))
const empty = computed(() => {
  if (!data.value) return null
  if (!(data.value.prompts || []).length) return NO_PROMPTS
  if (!rows.value.length) return { title: 'Brands appear here once the engines have answered your prompts.' }
  return null
})
</script>

<template>
  <BlockFrame
    widget="answer-rank"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :empty="empty"
    foot="Each prompt's latest answers."
    :skeleton="280"
    @retry="reload"
  >
    <div class="wd-rank">
      <p class="wd-rank-head cs-label" aria-hidden="true">
        <span>Brand</span>
        <span>Share of answers</span>
      </p>
      <p v-if="place" class="sr-only">{{ place }}</p>
      <ol class="wd-rank-rows" role="list" aria-label="Brands AI names, in order">
        <li v-for="row in rows" :key="row.key" class="wd-rank-row" :class="{ 'is-you': row.you, 'is-unplaced': row.rank === null }">
          <span class="sr-only">{{ row.sentence }}</span>
          <span class="wd-rank-index" aria-hidden="true">{{ row.index }}</span>
          <span class="wd-rank-name" aria-hidden="true" :title="row.name">
            <span v-if="row.you" class="wd-rank-mark cs-mark"></span>{{ row.you ? 'You' : row.name }}
          </span>
          <span class="wd-rank-track" aria-hidden="true">
            <span v-if="row.width" class="wd-rank-bar" :style="{ width: `${row.width}%` }"></span>
          </span>
          <span class="wd-rank-value" aria-hidden="true">{{ row.text }}</span>
        </li>
      </ol>
    </div>
  </BlockFrame>
</template>

<style scoped>
.wd-rank {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.wd-rank-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  font-size: 11px;
  white-space: nowrap;
}

/* One grid for every row: place, brand, bar, share. The rows take the
   card's height between them, so the list reads as one even column. */
.wd-rank-rows {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: max-content minmax(0, 0.8fr) minmax(0, 1fr) max-content;
  align-content: space-between;
  align-items: center;
  gap: 18px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wd-rank-row {
  display: contents;
}

.wd-rank-index,
.wd-rank-name,
.wd-rank-value {
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 14px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.wd-rank-index {
  min-width: 2ch;
  color: var(--subtle-foreground);
  font-variant-numeric: tabular-nums;
}

.wd-rank-name {
  overflow: hidden;
  color: var(--muted-foreground);
  text-overflow: ellipsis;
}

.wd-rank-row.is-you .wd-rank-name {
  color: var(--foreground);
}

.wd-rank-mark {
  margin-right: 7px;
  vertical-align: 1px;
}

.wd-rank-track {
  display: block;
  height: 12px;
}

.wd-rank-bar {
  display: block;
  height: 100%;
  min-width: 2px;
  background: var(--bar);
}

.wd-rank-row.is-you .wd-rank-bar {
  background: var(--foreground);
}

.wd-rank-value {
  min-width: 4ch;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.wd-rank-row.is-you .wd-rank-value {
  color: var(--foreground);
}

/* A brand with no share has no bar: its words take the bar's place. */
.wd-rank-row.is-unplaced .wd-rank-track {
  display: none;
}

.wd-rank-row.is-unplaced .wd-rank-value {
  grid-column: span 2;
}

@container wd-block (min-width: 560px) {
  .wd-rank-rows {
    grid-template-columns: max-content minmax(0, 180px) minmax(0, 1fr) max-content;
    column-gap: 20px;
  }
}
</style>
