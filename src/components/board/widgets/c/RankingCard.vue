<template>
  <div class="rk">
    <CardSkeleton v-if="phase === 'loading'" :height="size === 'full' ? 200 : 280" />
    <div v-else-if="phase === 'failed'" class="rk-state" role="alert">
      <p class="rk-state-title">{{ failedTitle }}</p>
      <AgButton size="sm" @click="reload">Try again</AgButton>
    </div>
    <template v-else>
      <p v-if="lead" class="rk-lead">
        {{ lead.text }}
        <HelpTip v-if="lead.turnOn" :text="TIPS.ranking.autopilot" label="About Autopilot" />
        <RouterLink v-if="lead.turnOn" class="rk-link" :to="{ name: 'settings-autopilot' }">Turn it on</RouterLink>
      </p>

      <div v-if="overCap" class="rk-notice">
        <p class="rk-notice-text">{{ overCap }}</p>
        <AgButton size="sm" variant="ghost" :to="{ name: 'billing' }">See plans</AgButton>
      </div>

      <div v-if="empty" class="rk-state is-inline">
        <p class="rk-state-title">
          {{ empty.title }}
          <HelpTip v-if="!empty.action" :text="TIPS.ranking.notRanked" label="Why prompts are not ranked yet" />
        </p>
        <AgButton v-if="empty.action" size="sm" @click="board.open('prompts', { add: '1' })">{{ empty.action }}</AgButton>
        <SetupPointer />
      </div>
      <div v-else class="rk-lists">
        <section class="rk-list" :aria-labelledby="topId">
          <div class="rk-list-head">
            <h3 :id="topId" class="rk-list-title">Keep you visible</h3>
            <HelpTip :text="TIPS.ranking.top" label="About Keep you visible" />
          </div>
          <BarList :items="lists.top" :max="100" label="Keep you visible" @select="openPrompt" />
        </section>
        <section v-if="lists.weakest.length" class="rk-list" :aria-labelledby="weakId">
          <div class="rk-list-head">
            <h3 :id="weakId" class="rk-list-title">Weakest</h3>
            <HelpTip :text="TIPS.ranking.weakest" label="About Weakest" />
          </div>
          <BarList :items="lists.weakest" :max="100" label="Weakest" @select="openPrompt" />
        </section>
      </div>

      <CardFoot v-if="footText || hasPrompts">
        <template v-if="footText">{{ footText }}</template>
        <template v-if="hasPrompts" #link>
          <AgButton size="sm" variant="ghost" @click="board.open('ranking')">All prompts</AgButton>
        </template>
      </CardFoot>
    </template>
  </div>
</template>

<script setup>
// Prompt ranking (autopilot_frontend.md 6e): the tracked prompts that keep
// you visible in AI answers and the weakest ones, by the share of the last
// 7 days' answers that name you. Both lists show at once (no switcher on a
// card); every bar is you, so every bar is the accent. The first line says
// what Autopilot did last, or that it is off. A row opens the prompt.
import { computed, useId } from 'vue'
import { RouterLink } from 'vue-router'
import AgButton from '@/components/agent/common/AgButton.vue'
import BarList from '@/components/board/BarList.vue'
import CardFoot from '@/components/board/CardFoot.vue'
import CardSkeleton from '@/components/board/CardSkeleton.vue'
import SetupPointer from '@/components/board/SetupPointer.vue'
import HelpTip from '@/components/ui/help/HelpTip.vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard, useCardStatus } from '@/lib/board/context'
import { cardStatus } from '@/lib/board/frame'
import { widgetMeta } from '@/lib/board/widgets'
import { TIPS } from '@/lib/help/tips'
import { COPY, autopilotLine, overCapLine, rankingEmpty, rankingFoot, rankingLists } from './specs'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'full' },
})

const board = useBoard()
const { data, failure, stale, reload } = useBoardSource('ranking')

const uid = useId()
const topId = `${uid}-top`
const weakId = `${uid}-weak`

const phase = computed(() => (data.value ? 'ready' : failure.value ? 'failed' : 'loading'))
const failedTitle = `We couldn't load ${widgetMeta('ranking')?.title || 'Prompt ranking'}.`

const prompts = computed(() => (Array.isArray(data.value?.prompts) ? data.value.prompts : []))
const hasPrompts = computed(() => prompts.value.length > 0)
const lead = computed(() => autopilotLine(data.value?.autopilot))
const overCap = computed(() => overCapLine(data.value?.tracked))
const empty = computed(() => rankingEmpty(data.value))
const lists = computed(() => rankingLists(prompts.value))
// The chip in the card's corner: live only with ranked prompts on show.
useCardStatus(() =>
  cardStatus({
    loading: phase.value === 'loading',
    failed: phase.value === 'failed',
    emptyKind: empty.value ? 'empty' : '',
    stale: stale.value,
  }),
)
const footText = computed(() =>
  [empty.value ? '' : rankingFoot(data.value), stale.value ? COPY.staleNote : ''].filter(Boolean).join(' '),
)

function openPrompt(promptId) {
  board.open('prompts', { prompt: String(promptId) })
}
</script>

<style scoped>
.rk {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.rk-state {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  min-height: 96px;
}

.rk-state.is-inline {
  min-height: 72px;
}

.rk-state-title {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.rk-lead {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 18px;
}

.rk-link {
  margin-left: 4px;
  color: var(--ag-fg-1);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rk-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.rk-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 8px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.rk-notice-text {
  flex: 1 1 240px;
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 18px;
}

.rk-lists {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.rk-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.rk-list-head {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.rk-list-title {
  margin: 0;
  color: var(--ag-fg-3);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* A wide card: the two lists side by side. */
@container bd-card (min-width: 720px) {
  .rk-lists {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
    gap: 32px;
  }
}
</style>
