<script setup>
// The Reports page's template gallery: the seven report templates of the
// backend catalog (GET report-templates/), each with a live preview built
// from the real report components and sample props, what it is for, what
// it needs, and "Use template", which opens ReportTemplateDialog. When the
// catalog call fails the gallery still lists the templates from the local
// copy and says it could not check which ones this workspace can run.
// Within a chat, the composer's "+" applies a template to the next reply.
import { computed, onMounted, ref, useId } from 'vue'
import { ChevronDown } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import ReportTemplateDialog from './ReportTemplateDialog.vue'
import ReportTemplatePreview from './ReportTemplatePreview.vue'
import { fallbackTemplates, promptRunsLine, requirementBadges } from '@/lib/agent/reportTemplates'
import { loadUiPrefs, saveUiPrefs } from '@/lib/agent/storage'
import { TIPS } from '@/lib/help/tips'
import { useAgentStore } from '@/stores/agent'

const PREF_KEY = 'reportGalleryHidden'

defineProps({
  websiteId: { type: String, default: null },
  // The project {name, url, competitors}, for the drafted request.
  website: { type: Object, default: null },
})

const store = useAgentStore()
const uid = useId()
const bodyId = `ag-rtg-${uid}`
const headingId = `ag-rtg-title-${uid}`

const canLoad = computed(() => typeof store.loadReportTemplates === 'function')
const state = computed(() => store.reportTemplates || null)
const templates = computed(() => {
  const items = state.value?.items
  if (Array.isArray(items) && items.length) return items
  // A store without the catalog (never loaded) shows the local copy.
  return canLoad.value ? [] : fallbackTemplates()
})
const loading = computed(() => Boolean(state.value?.loading) && !templates.value.length)
const unchecked = computed(() => !canLoad.value || state.value?.source === 'fallback')
const promptRuns = computed(() => store.status?.prompt_runs || null)

const hidden = ref(loadUiPrefs()[PREF_KEY] === true)
function toggle() {
  hidden.value = !hidden.value
  saveUiPrefs({ [PREF_KEY]: hidden.value })
}

function load(force = false) {
  if (!canLoad.value) return
  Promise.resolve(store.loadReportTemplates({ force })).catch(() => {})
}

onMounted(() => load())

const dialogOpen = ref(false)
const chosen = ref(null)
function use(template) {
  if (!template || !template.available) return
  chosen.value = template
  dialogOpen.value = true
}

const sectionText = (t) =>
  `Sections: ${t.sections.map((s) => (s.repeat === 'prompt' ? 'one section per prompt' : s.title)).join(', ')}.`
const cardId = (t, part) => `ag-rtg-${uid}-${t.id}-${part}`
</script>

<template>
  <section class="ag-rtg" :aria-labelledby="headingId">
    <div class="ag-rtg-head">
      <h2 :id="headingId" class="ag-rtg-title">
        Report templates
        <HelpTip :text="TIPS.agent.templates" label="About report templates" />
      </h2>
      <button
        type="button"
        class="ag-rtg-toggle"
        :aria-expanded="hidden ? 'false' : 'true'"
        :aria-controls="bodyId"
        @click="toggle"
      >
        {{ hidden ? 'Show templates' : 'Hide templates' }}
        <ChevronDown class="ag-rtg-chevron" :class="{ 'is-closed': hidden }" :size="14" aria-hidden="true" />
      </button>
    </div>

    <div v-show="!hidden" :id="bodyId">
      <p class="ag-rtg-intro">
        Start a report from a template: it opens a new chat with the request drafted for you to review and send. In an
        open chat, pick a template from + to shape the next reply.
      </p>

      <p v-if="unchecked && templates.length" class="ag-rtg-notice" role="status">
        <span>Couldn't check which templates this workspace can run. The agent says so when it sends if one can't.</span>
        <button v-if="canLoad" type="button" class="ag-rtg-retry" @click="load(true)">Try again</button>
      </p>

      <p v-if="loading" class="ag-sr-only" role="status">Loading report templates</p>
      <ul v-if="loading" class="ag-rtg-grid" aria-hidden="true">
        <li v-for="n in 3" :key="n" class="ag-rtg-card is-skeleton">
          <span class="ag-rtg-skel ag-rtg-skel-preview" />
          <span class="ag-rtg-skel ag-rtg-skel-line" />
          <span class="ag-rtg-skel ag-rtg-skel-line is-short" />
        </li>
      </ul>

      <ul v-else class="ag-rtg-grid" role="list">
        <li v-for="t in templates" :key="t.id" class="ag-rtg-item">
          <article
            class="ag-rtg-card"
            :class="{ 'is-unavailable': !t.available }"
            :aria-labelledby="cardId(t, 'name')"
            :aria-describedby="cardId(t, 'purpose')"
          >
            <ReportTemplatePreview :template="t" />
            <h3 :id="cardId(t, 'name')" class="ag-rtg-name">{{ t.name }}</h3>
            <p :id="cardId(t, 'purpose')" class="ag-rtg-purpose">{{ t.purpose }}</p>
            <p class="ag-sr-only">Preview with sample data. {{ sectionText(t) }}</p>
            <ul class="ag-rtg-badges" :aria-label="`What ${t.name} needs`">
              <li v-for="b in requirementBadges(t)" :key="b.key" class="ag-rtg-badge">{{ b.label }}</li>
            </ul>
            <p v-if="promptRunsLine(t, promptRuns)" class="ag-rtg-meta">{{ promptRunsLine(t, promptRuns) }}</p>
            <ul v-if="t.available && t.limitations.length" class="ag-rtg-limits">
              <li v-for="(l, i) in t.limitations" :key="`${l.code}-${i}`">
                {{ l.message }}<span v-if="l.setting" class="ag-rtg-setting"> Setting: {{ l.setting }}</span>
              </li>
            </ul>
            <p v-if="!t.available" :id="cardId(t, 'why')" class="ag-rtg-why">
              {{ t.unavailable ? t.unavailable.message : '' }}
              <span v-if="t.unavailable && t.unavailable.setting" class="ag-rtg-setting">
                Setting: {{ t.unavailable.setting }}</span
              >
            </p>
            <div class="ag-rtg-actions">
              <AgButton
                size="sm"
                :variant="t.available ? 'primary' : 'secondary'"
                :disabled="!t.available || !websiteId"
                :aria-label="`Use template: ${t.name}`"
                :aria-describedby="!t.available ? cardId(t, 'why') : undefined"
                @click="use(t)"
              >
                Use template
              </AgButton>
            </div>
          </article>
        </li>
      </ul>
    </div>

    <ReportTemplateDialog
      v-model:open="dialogOpen"
      :template="chosen"
      :website-id="websiteId"
      :website="website"
      :prompt-runs="promptRuns"
    />
  </section>
</template>

<style scoped>
.ag-rtg {
  margin-bottom: 24px;
}

.ag-rtg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.ag-rtg-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.ag-rtg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-fg-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.ag-rtg-toggle:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-rtg-toggle:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-rtg-chevron {
  transition: transform 160ms var(--ag-ease);
}

.ag-rtg-chevron.is-closed {
  transform: rotate(-90deg);
}

.ag-rtg-intro {
  margin: 0 0 12px;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtg-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 0 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 10px;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtg-retry {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ag-fg-1);
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.ag-rtg-retry:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-rtg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-rtg-item {
  display: flex;
  min-width: 0;
}

.ag-rtg-card {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-rtg-card:focus-within {
  border-color: color-mix(in srgb, var(--ag-card-border) 40%, var(--ag-fg-3));
}

.ag-rtg-name {
  margin: 4px 0 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.ag-rtg-purpose,
.ag-rtg-meta {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtg-meta {
  color: var(--ag-fg-3);
}

.ag-rtg-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-rtg-badge {
  padding: 1px 7px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 6px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-rtg-limits {
  margin: 0;
  padding-left: 16px;
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 18px;
}

.ag-rtg-why {
  margin: 0;
  color: var(--ag-warning);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtg-setting {
  color: var(--ag-fg-3);
  font-family: var(--ag-font-mono);
  font-size: 12px;
}

.ag-rtg-actions {
  display: flex;
  margin-top: auto;
  padding-top: 4px;
}

.ag-rtg-card.is-skeleton {
  gap: 10px;
}

.ag-rtg-skel {
  display: block;
  border-radius: 6px;
  background: var(--ag-row-hover);
  animation: ag-pulse 1.4s ease-in-out infinite;
}

.ag-rtg-skel-preview {
  height: 160px;
}

.ag-rtg-skel-line {
  width: 70%;
  height: 12px;
}

.ag-rtg-skel-line.is-short {
  width: 40%;
}

@media (prefers-reduced-motion: reduce) {
  .ag-rtg-skel {
    animation: none;
  }

  .ag-rtg-chevron {
    transition: none;
  }
}
</style>
