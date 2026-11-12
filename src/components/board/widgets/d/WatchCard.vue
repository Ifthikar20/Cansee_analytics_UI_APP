<script setup>
// Watch (board key "watch"): an eye on the project's tracking. The pupil
// follows the mouse; the words under it are the project's own: how many
// prompts are tracked and how many AI engines are set up to ask them
// (the search-gap overview). Nothing tracked yet says so and offers the
// way to add a prompt. A wide card, and the panel, list the engines.
import { computed, ref } from 'vue'
import { useBoardSource } from '@/composables/board/useBoardSource'
import { useBoard } from '@/lib/board/context'
import { gazeText, watchFacts, watchReadouts, watchSentence, watchStatus } from '@/lib/board/d/watch'
import { pad2 } from '@/lib/board/d/words'
import AgButton from '@/components/agent/common/AgButton.vue'
import SetupPointer from '@/components/board/SetupPointer.vue'
import BlockFrame from './BlockFrame.vue'
import WatchEye from './WatchEye.vue'
import { useGaze } from './useGaze'

defineProps({
  websiteId: { type: String, required: true },
  size: { type: String, default: 'third' },
})

const board = useBoard()
const { data, error, failure, stale, reload } = useBoardSource('overview')

const eye = ref(null)
const { look, following } = useGaze(eye)

const facts = computed(() => watchFacts(data.value))
const readouts = computed(() => watchReadouts(facts.value))
const sentence = computed(() => watchSentence(facts.value))
// 'live' needs no word; the others name the state the frame should show.
const gap = computed(() => ({ empty: 'empty', setup: 'not_connected' })[watchStatus(facts.value)] || '')
const tracking = computed(() => Boolean(facts.value?.prompts))
const engines = computed(() => (facts.value?.engines || []).map((e, i) => ({ ...e, index: pad2(i + 1) })))
const gazeLine = computed(() => (following.value ? `Looking at ${gazeText(look.value)}` : 'Looking straight ahead'))

function addPrompts() {
  board.open('prompts', { add: '1' })
}
</script>

<template>
  <BlockFrame
    widget="watch"
    :data="data"
    :error="error"
    :failure="failure"
    :stale="stale"
    :gap="gap"
    :skeleton="size === 'full' ? 320 : 260"
    @retry="reload"
  >
    <div class="wd-watch" :class="{ 'is-idle': !tracking }">
      <div class="wd-watch-stage">
        <p class="wd-watch-gaze cs-label" aria-hidden="true">{{ gazeLine }}</p>
        <div ref="eye" class="wd-watch-eye"><WatchEye :look="look" /></div>
      </div>

      <div class="wd-watch-facts">
        <p class="sr-only">{{ sentence }}</p>
        <p class="wd-watch-line" aria-hidden="true">
          <span class="cs-label cs-label--ink">{{ readouts.prompts }}</span>
          <span v-if="readouts.engines" class="cs-label">{{ readouts.engines }}</span>
        </p>
        <ul v-if="engines.length" class="wd-watch-engines" aria-hidden="true">
          <li v-for="engine in engines" :key="engine.key" class="wd-watch-engine" :class="{ 'is-off': !engine.ready }">
            <span class="wd-watch-index">{{ engine.index }}</span>
            <span class="wd-watch-name">{{ engine.label }}</span>
            <span class="wd-watch-state">{{ engine.ready ? 'Set up' : 'Not set up' }}</span>
          </li>
        </ul>
        <div v-if="!tracking" class="wd-watch-start">
          <AgButton size="sm" @click="addPrompts">Add prompts</AgButton>
          <SetupPointer />
        </div>
      </div>
    </div>
  </BlockFrame>
</template>

<style scoped>
.wd-watch {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* The gaze readout at the top, the eye in the middle of what is left. */
.wd-watch-stage {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.wd-watch-gaze {
  margin: 0;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The almond runs to the card's own margin, past the text's. */
.wd-watch-eye {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  margin: 0 -8px;
  padding: 16px 0;
}

.wd-watch-facts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.wd-watch-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
  margin: 0;
}

.wd-watch-line .cs-label {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.wd-watch-start {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

/* The engines, one per line: only where the card is wide enough to set
   them beside the eye. Narrow cards say the count in the line above. */
.wd-watch-engines {
  display: none;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--rule);
  list-style: none;
}

.wd-watch-engine {
  display: grid;
  grid-template-columns: 2.5ch minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--rule);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.wd-watch-index,
.wd-watch-state {
  color: var(--muted-foreground);
}

.wd-watch-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-watch-engine.is-off .wd-watch-name {
  color: var(--muted-foreground);
}

@container wd-block (min-width: 560px) {
  .wd-watch {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 260px);
    align-items: stretch;
    gap: 40px;
  }

  .wd-watch-eye {
    margin: 0;
  }

  /* The counts level with the gaze readout, the engines at the foot. */
  .wd-watch-facts {
    justify-content: space-between;
  }

  .wd-watch-engines {
    display: flex;
  }

  .wd-watch-line {
    order: -1;
  }
}
</style>
