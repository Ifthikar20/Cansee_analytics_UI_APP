<script setup>
// Track this prompt (autopilot_frontend.md 6c), on Ask AI's card and in its
// panel: the run's question becomes a tracked prompt without a scan, so
// nothing is spent twice; Autopilot asks it from its next run. The answers
// Ask AI got stay in its own tables. Past the plan's cap the server adds
// nothing and says why (403 tracked_prompt_limit). With `hint`, the first
// time the button shows it is pointed out (hint board.track).
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import promptBoxApi from '@/api/promptBox'
import AgButton from '@/components/agent/common/AgButton.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import HintCallout from '@/components/ui/help/HintCallout.vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import { useAgentUiStore } from '@/stores/agentUi'
import { TIPS } from '@/lib/help/tips'
import { COPY, failureOf } from './specs'
import { rememberTracked, trackedOf } from './usePromptBoxRun'

const props = defineProps({
  websiteId: { type: String, required: true },
  // The run whose question is tracked: {id, text, tracked: {prompt_id, brand_prompt_id}}.
  run: { type: Object, required: true },
  // Offer the first-visit hint (the card, once its run has ended).
  hint: { type: Boolean, default: false },
})

const board = useBoard()
const ui = useAgentUiStore()
// Whether Autopilot runs for this project decides what Tracked promises.
const ranking = useBoardSource('ranking')

const saving = ref(false)
// '' | 'tracked' (here, just now) | 'limit' (the plan's cap) | 'error'
const outcome = ref('')
const message = ref('')

const trackedId = computed(
  () => trackedOf(props.websiteId, props.run?.text)?.prompt_id || props.run?.tracked?.prompt_id || null,
)
// Unknown counts as off: never promise a run that may not come.
const autopilotOn = computed(() => ranking.data.value?.autopilot?.enabled === true)

watch(
  () => props.run?.id,
  () => {
    outcome.value = ''
    message.value = ''
  },
)

async function track() {
  const text = props.run?.text
  if (saving.value || !text) return
  saving.value = true
  outcome.value = ''
  message.value = ''
  try {
    const res = await promptBoxApi.track(props.websiteId, text)
    const data = res?.data || {}
    rememberTracked(props.websiteId, text, {
      prompt_id: data.id ? String(data.id) : null,
      brand_prompt_id: data.brand_prompt_id ? String(data.brand_prompt_id) : null,
    })
    outcome.value = 'tracked'
    ui.announce(autopilotOn.value ? COPY.trackedNext : 'Tracked. Turn on Autopilot to check it every day.')
    board.invalidate('ranking')
    board.invalidate('overview')
    board.invalidate('visibility')
  } catch (err) {
    const failure = failureOf(err)
    outcome.value = failure.code === 'tracked_prompt_limit' ? 'limit' : 'error'
    message.value = failure.message
  } finally {
    saving.value = false
  }
}

function openPrompt() {
  if (trackedId.value) board.open('prompts', { prompt: trackedId.value })
}
</script>

<template>
  <div class="pb-track">
    <p v-if="outcome === 'tracked'" class="pb-track-note">
      <template v-if="autopilotOn">{{ COPY.trackedNext }}</template>
      <template v-else>
        Tracked. <RouterLink class="pb-track-link" :to="{ name: 'settings-autopilot' }">Turn on Autopilot</RouterLink> to
        check it every day.
      </template>
    </p>
    <template v-else-if="trackedId">
      <p class="pb-track-note">{{ COPY.alreadyTracked }}</p>
      <AgButton size="sm" variant="ghost" @click="openPrompt">Open it</AgButton>
    </template>
    <template v-else>
      <HintCallout hint="board.track" :when="hint && !saving">
        <AgButton size="sm" :loading="saving" @click="track">Track this prompt</AgButton>
      </HintCallout>
      <HelpTip :text="TIPS.askAi.track" label="About tracking this prompt" />
      <p v-if="outcome === 'limit'" class="pb-track-note" role="alert">
        {{ message }} <RouterLink class="pb-track-link" :to="{ name: 'billing' }">See plans</RouterLink>
      </p>
      <p v-else-if="outcome === 'error'" class="pb-track-note" role="alert">{{ message }}</p>
    </template>
  </div>
</template>

<style scoped>
.pb-track {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
}

.pb-track-note {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.pb-track-link {
  color: var(--ag-fg-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.pb-track-link:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
