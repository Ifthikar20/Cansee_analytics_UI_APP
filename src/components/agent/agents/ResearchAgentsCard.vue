<script setup>
// The research agents on the Agents page: what they do, how many one
// research can run (the server's ceiling, GET status/ swarm.max_agents),
// and presets that draft a research request for a new Gap Analyst chat
// (research_swarm is the Gap Analyst's tool). A preset only opens the task
// dialog on that template; nothing runs until the person sends the message.
//
// When the research agents cannot run, the presets and Use are
// aria-disabled (still focusable) and described by the reason, with what to
// do in a HelpTip; never a title=.
import { computed } from 'vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { kindMeta } from '@/lib/agent/agentsMeta'
import { blockHelp, researchCeiling, researchFit, researchRunsLine } from '@/lib/agent/availability'
import { RESEARCH_AGENTS } from '@/lib/agent/researchAgents'
import { formTemplates } from '@/lib/agent/taskTemplates'
import { TIPS } from '@/lib/help/tips'

const props = defineProps({
  // GET status/
  status: { type: Object, default: null },
  // why the research agents cannot run ({title, action, setting}), or null
  block: { type: Object, default: null },
  noProject: { type: Boolean, default: false },
})

const emit = defineEmits(['use'])

const meta = RESEARCH_AGENTS
const presets = formTemplates(meta.key)

const ceiling = computed(() => researchCeiling(props.status))
// The default plan; on an account that counts prompt runs, also within the
// runs left (one engine answer is one run).
const fit = computed(() => researchFit(props.status))
const ceilingText = computed(() => {
  if (!ceiling.value) return ''
  const head = `Up to ${ceiling.value} agents per research`
  const f = fit.value
  if (!f) return `${head}.`
  const runs = researchRunsLine(f)
  if (runs) return `${head}. ${runs}`
  return `${head}, enough for ${f.prompts === 1 ? '1 prompt' : `${f.prompts} prompts`} with what is set up here.`
})

const reason = computed(() => props.block?.title || (props.noProject ? TIPS.agent.noProject : ''))
const help = computed(() => blockHelp(props.block))
const off = computed(() => Boolean(reason.value))
const whyId = 'ag-research-why'
const presetsId = 'ag-research-presets'

function use(template = '') {
  if (off.value) return
  emit('use', template)
}
</script>

<template>
  <li class="ag-research" :class="{ 'is-off': off }" aria-labelledby="ag-research-name">
    <div class="ag-research-main">
      <div class="ag-research-head">
        <span class="ag-research-icon" :style="{ color: kindMeta(meta.outputKind).color }" aria-hidden="true">
          <component :is="meta.icon" :size="14" />
        </span>
        <h2 id="ag-research-name" class="ag-research-name">{{ meta.name }}</h2>
      </div>
      <ul class="ag-research-teams" role="list" aria-label="Teams">
        <li v-for="t in meta.teams" :key="t.key" class="ag-research-team">{{ t.label }}</li>
      </ul>
      <p class="ag-research-desc">{{ meta.description }}</p>
      <p v-if="ceilingText" class="ag-research-meta">
        <span>{{ ceilingText }}</span>
        <HelpTip :text="TIPS.agents.ceiling" label="About the research agent limit" />
      </p>
      <div class="ag-research-actions">
        <p v-if="reason" class="ag-research-why">
          <span :id="whyId">{{ reason }}</span>
          <HelpTip v-if="help" :text="help" :label="`What to do: ${meta.name}`" />
        </p>
        <AgButton
          size="sm"
          :aria-label="`Use ${meta.name}`"
          :aria-disabled="off ? 'true' : undefined"
          :aria-describedby="off ? whyId : undefined"
          @click="use()"
        >
          Use
        </AgButton>
      </div>
    </div>

    <div class="ag-research-presets">
      <p :id="presetsId" class="ag-research-presets-label">
        <span>Presets</span>
        <HelpTip :text="TIPS.agents.presets" label="About research presets" />
      </p>
      <ul class="ag-research-preset-list" role="list" :aria-labelledby="presetsId">
        <li v-for="p in presets" :key="p.key">
          <button
            type="button"
            class="ag-research-preset"
            :aria-disabled="off ? 'true' : undefined"
            :aria-describedby="off ? whyId : `ag-research-preset-${p.key}`"
            @click="use(p.key)"
          >
            <span class="ag-research-preset-name">{{ p.label }}</span>
            <span :id="`ag-research-preset-${p.key}`" class="ag-research-preset-summary">{{ p.summary }}</span>
          </button>
        </li>
      </ul>
    </div>
  </li>
</template>

<style scoped>
.ag-research {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px 24px;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-research-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ag-research-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ag-research-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: 6px;
}

.ag-research-name {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-research-teams {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-research-team {
  padding: 0 7px;
  border: 1px solid var(--ag-card-border);
  border-radius: 999px;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-research-desc {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 21px;
}

.ag-research-meta,
.ag-research-presets-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-research-presets-label {
  color: var(--ag-fg-1);
  font-weight: 500;
}

.ag-research-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: auto;
  padding-top: 4px;
}

.ag-research-why {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  margin: 0;
  color: var(--ag-warning);
  font-size: 13px;
  line-height: 18px;
}

.ag-research-presets {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ag-research-preset-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-research-preset-list > li {
  display: flex;
  min-width: 0;
}

.ag-research-preset {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 8px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.ag-research-preset:hover:not([aria-disabled='true']) {
  background: var(--ag-btn-hover);
}

.ag-research-preset[aria-disabled='true'] {
  opacity: 0.5;
  cursor: default;
}

.ag-research-preset:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-research-preset-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.ag-research-preset-summary {
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 17px;
}

@media (max-width: 720px) {
  .ag-research {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 420px) {
  .ag-research-preset-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
