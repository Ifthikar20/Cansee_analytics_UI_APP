<template>
  <div ref="frame" class="ag-rtp" :style="{ '--ag-rtp-scale': scale, height: `${height}px` }">
    <!-- A picture of the report, not part of the page: hidden from screen
         readers (the card lists the sections in words) and inert, so none
         of the real components inside can take focus or clicks. -->
    <div class="ag-rtp-stage" aria-hidden="true" inert>
      <ReportHeader :header="header" :template="template.id" sample />
      <section v-for="(section, i) in sections" :key="`${i}-${section.title}`" class="ag-rtp-sec">
        <h4 class="ag-rtp-title">{{ section.heading }}</h4>

        <div v-if="isTiles(section.view)" class="ag-rtp-tiles">
          <VizStatTile v-for="tile in section.sample" :key="tile.label" v-bind="tile" />
        </div>

        <ul v-else-if="section.view === 'gap_mix'" class="ag-rtp-mix">
          <li v-for="row in section.sample" :key="row.cls">
            <GapBadge :cls="row.cls" />
            <span class="ag-rtp-count">{{ row.count }}</span>
          </li>
        </ul>

        <Leaderboard v-else-if="section.view === 'leaderboard'" :brands="section.sample" />

        <VizTable v-else-if="isTable(section.view)" :spec="section.sample" compact />

        <ActionList v-else-if="section.view === 'actions'" :actions="section.sample" />

        <div v-else-if="section.view === 'verdict'" class="ag-rtp-verdict">
          <GapBadge :gap="section.sample.gap" show-value />
          <p class="ag-rtp-line">{{ section.sample.line }}</p>
        </div>

        <div v-else-if="section.view === 'engine_cards'" class="ag-rtp-engines">
          <EngineCard v-for="engine in section.sample.engines" :key="engine.key" :engine="engine" />
        </div>

        <div v-else-if="section.view === 'prompt_detail'" class="ag-rtp-prompt">
          <p class="ag-rtp-line">
            <GapBadge :gap="section.sample.gap" show-value />
          </p>
          <div class="ag-rtp-engines">
            <EngineCard v-for="engine in section.sample.engines" :key="engine.key" :engine="engine" />
          </div>
          <p class="ag-rtp-note">One section like this per prompt.</p>
        </div>

        <ul v-else-if="Array.isArray(section.sample)" class="ag-rtp-lines">
          <li v-for="line in section.sample" :key="line">{{ line }}</li>
        </ul>

        <p v-else class="ag-rtp-line">{{ section.shows }}</p>
      </section>
    </div>
    <span class="ag-rtp-badge" aria-hidden="true">Sample</span>
  </div>
</template>

<script setup>
// A live, scaled-down picture of what a report template produces: the real
// ReportHeader and the real section components (VizStatTile, GapBadge,
// Leaderboard, VizTable, EngineCard, ActionList) rendered with the fixed
// sample props of lib/agent/reportTemplateSamples, never with the
// project's data and never with a network call. The stage is laid out at
// STAGE_WIDTH and scaled to the frame's width.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ReportHeader from '@/components/agent/browser/views/ReportHeader.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizTable from '@/components/charts/VizTable.vue'
import ActionList from '@/components/gap/ActionList.vue'
import EngineCard from '@/components/gap/EngineCard.vue'
import GapBadge from '@/components/gap/GapBadge.vue'
import Leaderboard from '@/components/gap/Leaderboard.vue'
import { sectionView } from '@/lib/agent/reportTemplates'
import { SAMPLE_PROMPTS, sampleFor, sampleHeader } from '@/lib/agent/reportTemplateSamples'

const STAGE_WIDTH = 640
const DEFAULT_SCALE = 0.42

const props = defineProps({
  // A template of lib/agent/reportTemplates.
  template: { type: Object, required: true },
  // The frame's height in pixels; the stage below it is cut off.
  height: { type: Number, default: 210 },
})

const TILES = new Set(['kpis', 'citation_totals', 'coverage', 'unchanged', 'trend'])
const TABLES = new Set([
  'gap_rows',
  'results_table',
  'competitor_ranks',
  'page_compare',
  'sources_table',
  'google_results',
  'themes',
  'changes',
])
const isTiles = (view) => TILES.has(view)
const isTable = (view) => TABLES.has(view)

const header = computed(() => sampleHeader(props.template.id))

const sections = computed(() =>
  (props.template.sections || []).map((section) => {
    const view = sectionView(props.template.id, section)
    return {
      ...section,
      view,
      // A section repeated per prompt is titled with the (sample) prompt.
      heading: view === 'prompt_detail' ? `"${SAMPLE_PROMPTS[0]}"` : section.title,
      sample: view === 'text' ? null : sampleFor(view),
    }
  })
)

const frame = ref(null)
const scale = ref(DEFAULT_SCALE)
let observer = null

function measure() {
  const width = frame.value?.clientWidth || 0
  if (width > 0) scale.value = Math.min(1, width / STAGE_WIDTH)
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'function' && frame.value) {
    observer = new ResizeObserver(measure)
    observer.observe(frame.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.ag-rtp {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--ag-card-border);
  border-radius: 10px;
  background: var(--ag-pane-bg);
}

/* The bottom fades out: the stage is longer than the frame. */
.ag-rtp::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 36px;
  background: linear-gradient(to bottom, transparent, var(--ag-pane-bg));
  content: '';
  pointer-events: none;
}

.ag-rtp-stage {
  box-sizing: border-box;
  width: 640px;
  padding: 20px 22px;
  transform: scale(var(--ag-rtp-scale));
  transform-origin: top left;
  pointer-events: none;
  user-select: none;
}

.ag-rtp-stage :deep(.ag-rh) {
  margin-bottom: 16px;
}

.ag-rtp-sec + .ag-rtp-sec {
  margin-top: 16px;
}

.ag-rtp-title {
  margin: 0 0 8px;
  color: var(--ag-fg-1);
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
}

.ag-rtp-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.ag-rtp-mix {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  list-style: none;
}

.ag-rtp-count {
  margin-left: 6px;
  color: var(--ag-fg-3);
  font-variant-numeric: tabular-nums;
}

.ag-rtp-engines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ag-rtp-line,
.ag-rtp-lines,
.ag-rtp-note {
  margin: 0 0 6px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtp-lines {
  padding-left: 18px;
}

.ag-rtp-note {
  margin-top: 8px;
  color: var(--ag-fg-3);
  font-style: italic;
}

.ag-rtp-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  padding: 2px 7px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 6px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 16px;
  text-transform: uppercase;
}
</style>
