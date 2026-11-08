<script setup>
// A first-visit hint (coachmark) pointing at its slot: a title, one or two
// sentences, "Got it" and "Skip tips". The hints store decides whether it
// shows (one at a time, once per user, never during onboarding or for a
// viewer); `when` says the target is on screen and ready (its data loaded,
// the action available).
//
// Non-modal and it never takes focus, so typing in the composer or a field
// goes on. Escape, "Got it" or a press elsewhere on the page dismisses it
// for good; "Skip tips" turns every hint off. Tabbing away leaves it open.
// It is announced once to screen readers when it appears. The dialog is
// named by aria-label: reka sets aria-labelledby to its (absent) trigger.
//
//   <HintCallout hint="board.add-widget" :when="!loading"><AgButton>Add widget</AgButton></HintCallout>
import { computed, onBeforeUnmount, useId, watch } from 'vue'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { hintOf } from '@/lib/help/hints'
import { useHintsStore } from '@/stores/hints'
import { useAgentUiStore } from '@/stores/agentUi'
import './help.css'

const props = defineProps({
  hint: { type: String, required: true },
  when: { type: Boolean, default: true },
  side: { type: String, default: 'bottom' },
  align: { type: String, default: 'start' },
  sideOffset: { type: Number, default: 8 },
})

const hints = useHintsStore()
const ui = useAgentUiStore()

const meta = computed(() => hintOf(props.hint))
const open = computed(() => Boolean(meta.value) && hints.isActive(props.hint))

const uid = useId()
const bodyId = `cs-hint-${uid}-body`

watch(
  () => [props.hint, props.when],
  ([key, when], before) => {
    const [prevKey] = before || []
    if (prevKey && prevKey !== key) hints.unregister(prevKey)
    if (when) hints.register(key)
    else hints.unregister(key)
  },
  { immediate: true },
)

onBeforeUnmount(() => hints.unregister(props.hint))

watch(
  open,
  (isOpen) => {
    if (isOpen && meta.value) ui.announce(`Tip: ${meta.value.title}. ${meta.value.body} Press Escape to dismiss.`)
  },
  { immediate: true },
)

function dismiss() {
  hints.dismiss(props.hint)
}

function skip() {
  hints.skipAll()
}

// Escape or a press outside: reka asks to close.
function onOpenChange(value) {
  if (!value && open.value) dismiss()
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="onOpenChange">
    <PopoverAnchor as-child>
      <slot />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        v-if="meta"
        class="cs-hint"
        :data-hint="hint"
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        :collision-padding="8"
        :aria-label="meta.title"
        :aria-describedby="bodyId"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @focus-outside.prevent
      >
        <p class="cs-hint-title">{{ meta.title }}</p>
        <p :id="bodyId" class="cs-hint-body">{{ meta.body }}</p>
        <div class="cs-hint-actions">
          <button type="button" class="cs-hint-btn" @click="skip">Skip tips</button>
          <button type="button" class="cs-hint-btn is-primary" @click="dismiss">Got it</button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
