<script setup>
// One agent on the Agents page: what it is, its teams, what it delivers,
// the analytics tabs whose Ask the agent drafts hand work to it, a starter
// and Use. The four general agents open a new chat with the agent picked;
// the six specialists ask for their inputs first (AgentTaskDialog).
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgTooltip from '@/components/agent/common/AgTooltip.vue'
import { kindMeta } from '@/lib/agent/agentsMeta'

const DELIVERS_BY_KIND = {
  report: 'Writes a report you can save to Reports',
  page: 'Builds a landing page',
  document: 'Writes an article for Documents',
  sheet: 'Builds an ad campaign sheet',
}

const DELIVERS_BY_AGENT = {
  page_optimizer: 'A revised page with every change listed',
  comparison_page: 'A comparison page with its sources',
  social_posts: 'Posts for each network, with character counts',
  pr_writer: 'A press release, a pitch or correction requests',
  llms_txt: 'An llms.txt file',
  messaging_brief: 'A messaging brief',
}

const props = defineProps({
  // agentList() entry: {key, name, icon, outputKind, description, starter, teams, unavailable}
  agent: { type: Object, required: true },
  // a router location for Use (the four general agents), null to emit `use`
  to: { type: Object, default: null },
  // [{key, label, to}] analytics tabs that hand work to this agent
  startsFrom: { type: Array, default: () => [] },
  // why Use is off for every agent ('' when it is on)
  offReason: { type: String, default: '' },
  // no project in scope
  noProject: { type: Boolean, default: false },
})

const emit = defineEmits(['use'])

const delivers = computed(
  () => DELIVERS_BY_AGENT[props.agent.key] || DELIVERS_BY_KIND[props.agent.outputKind] || '',
)
const teams = computed(() => (Array.isArray(props.agent.teams) ? props.agent.teams : []))
const blockedReason = computed(() => props.offReason || props.agent.unavailable || '')
const whyId = computed(() => `ag-agent-why-${props.agent.key}`)
</script>

<template>
  <li class="ag-agent">
    <div class="ag-agent-head">
      <span class="ag-agent-icon" :style="{ color: kindMeta(agent.outputKind).color }" aria-hidden="true">
        <component :is="agent.icon" :size="14" />
      </span>
      <h2 class="ag-agent-name">{{ agent.name }}</h2>
    </div>
    <ul v-if="teams.length" class="ag-agent-teams" role="list" aria-label="Teams">
      <li v-for="t in teams" :key="t.key" class="ag-agent-team">{{ t.label }}</li>
    </ul>
    <p v-if="agent.description" class="ag-agent-desc">{{ agent.description }}</p>
    <p v-if="delivers" class="ag-agent-meta">{{ delivers }}</p>
    <p v-if="startsFrom.length" class="ag-agent-from">
      <span class="ag-agent-from-label">Starts from</span>
      <span class="ag-agent-from-links">
        <template v-for="(s, i) in startsFrom" :key="s.key">
          <RouterLink v-if="s.to" :to="s.to" class="ag-agent-from-link">{{ s.label }}</RouterLink>
          <span v-else>{{ s.label }}</span><template v-if="i < startsFrom.length - 1">, </template>
        </template>
      </span>
    </p>
    <p v-if="agent.starter" class="ag-agent-starter">
      <span class="ag-agent-starter-label">Try</span>
      <span class="ag-agent-starter-text">{{ agent.starter }}</span>
    </p>
    <div class="ag-agent-actions">
      <p v-if="!offReason && agent.unavailable" :id="whyId" class="ag-agent-why">{{ agent.unavailable }}</p>
      <AgTooltip v-if="offReason" :text="offReason">
        <button type="button" class="ag-agent-use-off" aria-disabled="true" :aria-label="`Use ${agent.name}`">Use</button>
      </AgTooltip>
      <AgButton
        v-else-if="to"
        size="sm"
        :to="!blockedReason && !noProject ? to : null"
        :disabled="noProject || Boolean(blockedReason)"
        :aria-label="`Use ${agent.name}`"
        :aria-describedby="agent.unavailable ? whyId : undefined"
      >
        Use
      </AgButton>
      <AgButton
        v-else
        size="sm"
        :disabled="noProject || Boolean(blockedReason)"
        :aria-label="`Use ${agent.name}`"
        :aria-describedby="agent.unavailable ? whyId : undefined"
        @click="emit('use', agent)"
      >
        Use
      </AgButton>
    </div>
  </li>
</template>

<style scoped>
.ag-agent {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-height: 168px;
  padding: 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-agent-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ag-agent-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: 6px;
}

.ag-agent-name {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.ag-agent-teams {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-agent-team {
  padding: 0 7px;
  border: 1px solid var(--ag-card-border);
  border-radius: 999px;
  color: var(--ag-fg-2);
  font-size: 12px;
  line-height: 18px;
}

.ag-agent-desc {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 21px;
}

.ag-agent-meta,
.ag-agent-from {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
}

.ag-agent-from {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}

.ag-agent-from-label {
  color: var(--ag-fg-3);
  font-weight: 500;
}

.ag-agent-from-link {
  color: var(--ag-fg-1);
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
}

.ag-agent-from-link:hover {
  text-decoration-color: currentColor;
  opacity: 1;
}

.ag-agent-from-link:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-agent-starter {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--ag-bubble-bg);
  color: var(--ag-fg-1b);
  font-size: 13px;
  line-height: 19px;
}

.ag-agent-starter-label {
  flex-shrink: 0;
  color: var(--ag-fg-3);
  font-weight: 500;
}

.ag-agent-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: auto;
  padding-top: 4px;
}

.ag-agent-why {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--ag-warning);
  font-size: 13px;
  line-height: 18px;
}

.ag-agent-use-off {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ag-btn-border);
  border-radius: 8px;
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.5;
  cursor: default;
}

.ag-agent-use-off:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
