<script setup>
// The "latest-report" block: the project's newest saved report as a cover.
// Its template in the small label, its title in the display type, then the
// day it was saved, the engines it asked and the link that opens it. The
// title, date and version come from the list the Reports page reads; the
// template and engines from the report's own header, shown once it loads
// and left out for a report that has none. At full size the reports before
// it follow.
import { computed, useId } from 'vue'
import { RouterLink } from 'vue-router'
import AgButton from '@/components/agent/common/AgButton.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import CardState from '@/components/board/widgets/a/CardState.vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useCardStatus } from '@/lib/board/context'
import { cardStatus } from '@/lib/board/frame'
import { coverModel, earlierReports, reportsList, reportsLocation } from '@/lib/board/e/report'
import { useReportDetail } from './useReportDetail'

const props = defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'half' },
})

const source = useBoardSource('reports')
const loaded = computed(() => source.data.value !== null && source.data.value !== undefined)
const reports = computed(() => reportsList(source.data.value))
const latest = computed(() => reports.value[0] || null)
const detail = useReportDetail(() => props.websiteId, latest)
const cover = computed(() => coverModel(latest.value, detail.value, props.websiteId))
const full = computed(() => props.size === 'full')
const earlier = computed(() => (full.value ? earlierReports(reports.value, props.websiteId) : []))
const allReports = computed(() => reportsLocation(props.websiteId))
const earlierId = `lr-earlier-${useId()}`

const phase = computed(() => {
  if (loaded.value) return cover.value ? 'ready' : 'empty'
  return source.failure.value || source.error.value ? 'failed' : 'loading'
})

useCardStatus(() =>
  cardStatus({
    loading: phase.value === 'loading',
    failed: phase.value === 'failed',
    failedKind: 'error',
    emptyKind: phase.value === 'empty' ? 'empty' : '',
    stale: Boolean(source.stale.value),
  }),
)
</script>

<template>
  <CardSkeleton v-if="phase === 'loading'" />
  <CardState
    v-else-if="phase === 'failed'"
    kind="error"
    title="The latest report couldn't load."
    :action="{ label: 'Try again' }"
    @action="source.reload()"
  />
  <CardState
    v-else-if="phase === 'empty'"
    title="No saved report yet."
    body="Start one from a report template. A report you save from a chat shows here."
    :action="{ label: 'Report templates', to: allReports }"
  />
  <div v-else class="lr" :class="{ 'is-full': full }">
    <article class="lr-cover" :class="`is-${cover.scale}`">
      <header class="lr-top">
        <span class="lr-kind cs-label cs-label--ink">
          <span class="cs-mark" aria-hidden="true"></span>{{ cover.template || 'Report' }}
        </span>
        <span v-if="cover.version" class="cs-label">{{ cover.version }}</span>
      </header>

      <h3 class="lr-title">
        <RouterLink v-if="cover.to" class="lr-title-link" :to="cover.to">{{ cover.title }}</RouterLink>
        <template v-else>{{ cover.title }}</template>
      </h3>

      <footer class="lr-foot">
        <dl class="lr-meta">
          <div v-if="cover.date" class="lr-meta-item">
            <dt class="cs-label">Saved</dt>
            <dd class="cs-label cs-label--ink">{{ cover.date }}</dd>
          </div>
          <div v-if="cover.enginesText" class="lr-meta-item is-wide">
            <dt class="cs-label">Engines</dt>
            <dd class="cs-label cs-label--ink">{{ cover.enginesText }}</dd>
          </div>
          <div v-if="cover.author && full" class="lr-meta-item">
            <dt class="cs-label">By</dt>
            <dd class="cs-label cs-label--ink">{{ cover.author }}</dd>
          </div>
        </dl>
        <RouterLink v-if="cover.to" class="lr-open" :to="cover.to" :aria-label="`Open report: ${cover.title}`">
          Open report
          <svg class="lr-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
        </RouterLink>
      </footer>
    </article>

    <section v-if="full" class="lr-earlier" :aria-labelledby="earlierId">
      <h3 :id="earlierId" class="lr-earlier-title">Earlier reports</h3>
      <ol v-if="earlier.length" class="lr-list">
        <li v-for="row in earlier" :key="row.id" class="lr-row">
          <span class="lr-row-index" aria-hidden="true">{{ row.index }}</span>
          <RouterLink class="lr-row-link" :to="row.to">{{ row.title }}</RouterLink>
          <span v-if="row.date" class="lr-row-date cs-label">{{ row.date }}</span>
        </li>
      </ol>
      <p v-else class="lr-none">This is the only saved report of this project.</p>
      <div class="lr-actions">
        <AgButton size="sm" :to="allReports">All reports and templates</AgButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lr {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 40px;
  min-width: 0;
}

/* The cover: a small line at the top, the title in the display type and,
   under a hairline at the foot, when it was saved, what it asked and the
   way in. */
.lr-cover {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 248px;
}

.lr.is-full .lr-cover {
  flex: 0 0 auto;
  min-height: 300px;
}

.lr-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.lr-kind {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.lr-title {
  display: -webkit-box;
  max-width: 16ch;
  margin: 28px 0 24px;
  overflow: hidden;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: clamp(30px, 7.6cqi, 64px);
  font-weight: 500;
  line-height: 1.04;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
  text-wrap: balance;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.lr-cover.is-md .lr-title {
  max-width: 24ch;
  font-size: clamp(26px, 5.6cqi, 48px);
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.lr-cover.is-sm .lr-title {
  max-width: 40ch;
  font-size: clamp(21px, 3.8cqi, 32px);
  line-height: 1.14;
  letter-spacing: -0.02em;
  -webkit-line-clamp: 4;
  line-clamp: 4;
}

.lr-title-link {
  color: inherit;
  text-decoration: none;
}

.lr-title-link:hover {
  text-decoration: underline;
  text-decoration-thickness: 0.04em;
  text-underline-offset: 0.12em;
}

.lr-title-link:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.lr-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--rule);
}

.lr-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  min-width: 0;
  margin: 0;
}

.lr-meta-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.lr-meta-item dt,
.lr-meta-item dd {
  margin: 0;
}

.lr-meta-item dd {
  overflow-wrap: anywhere;
}

.lr-open {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  border-bottom: 1px solid var(--foreground);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

.lr-open:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}

.lr-arrow {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
}

@media (prefers-reduced-motion: no-preference) {
  .lr-arrow {
    transition: transform 140ms ease;
  }

  .lr-open:hover .lr-arrow {
    transform: translateX(3px);
  }
}

/* The reports before it, at full size. */
.lr-earlier {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* A heading set as the board's small label (the page's heading styles
   would otherwise win over the shared class). */
.lr-earlier-title {
  margin: 0;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.lr-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lr-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0 12px;
  padding: 11px 0;
  border-top: 1px solid var(--rule);
}

.lr-row-index {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.lr-row-link {
  overflow: hidden;
  color: var(--foreground);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: -0.01em;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lr-row-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lr-row-link:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.lr-row-date {
  white-space: nowrap;
}

.lr-none {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 19px;
}

.lr-actions {
  margin-top: 4px;
}
</style>
