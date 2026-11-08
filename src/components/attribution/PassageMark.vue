<script setup>
// The cited passage in the source viewer, with its hover card: the
// suggested edit (own pages only) and the reference (which engine answered,
// and the part of the answer this passage supports).
//
// The card opens on hover and on keyboard focus, and stays open while the
// pointer or focus is inside it, so "Copy proposed text" can be reached with
// Tab. Built on reka's Popover rather than HoverCard: HoverCard removes its
// content's controls from the tab order. Escape closes the card first; the
// viewer's own Escape handling takes the next press.
import { computed, onBeforeUnmount, ref } from 'vue'
import { PopoverAnchor, PopoverContent, PopoverRoot } from 'reka-ui'
import { Check, Copy } from '@lucide/vue'
import { normalizeOwner } from '@/lib/attribution/answerHtml'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  finding: { type: Object, required: true },
  engineLabel: { type: String, default: 'The AI engine' },
})

const OPEN_DELAY = 150
const CLOSE_DELAY = 200

const open = ref(false)
const markRef = ref(null)
const cardRef = ref(null)
const copied = ref(false)
let timer = null
let pointerInside = false
let copiedTimer = null

const owner = computed(() => normalizeOwner(props.finding.source?.owner))
const toast = useToast()

function clear() {
  if (timer) clearTimeout(timer)
  timer = null
}
function focusInside() {
  const active = document.activeElement
  return Boolean(active && (markRef.value?.contains(active) || cardRef.value?.contains(active)))
}
function show(delay = 0) {
  clear()
  if (!delay) open.value = true
  else timer = setTimeout(() => (open.value = true), delay)
}
function hideSoon() {
  clear()
  timer = setTimeout(() => {
    if (!pointerInside && !focusInside()) open.value = false
  }, CLOSE_DELAY)
}
function onPointerEnter() {
  pointerInside = true
  show(OPEN_DELAY)
}
function onCardEnter() {
  pointerInside = true
  clear()
}
function onPointerLeave() {
  pointerInside = false
  hideSoon()
}
function onOpenChange(value) {
  if (value) show()
  else {
    clear()
    open.value = false
  }
}
// Focus moving back to the mark is not an outside interaction.
function onInteractOutside(event) {
  if (markRef.value?.contains(event.target)) event.preventDefault()
}
function onEscape(event) {
  if (!open.value) return
  event.preventDefault()
  event.stopPropagation()
  clear()
  open.value = false
  markRef.value?.focus()
}

async function copyProposed() {
  try {
    await navigator.clipboard.writeText(props.finding.suggestion?.after || '')
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    toast.error("We couldn't copy the text.")
  }
}

onBeforeUnmount(() => {
  clear()
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <PopoverRoot :open="open" @update:open="onOpenChange">
    <PopoverAnchor as-child>
      <mark
        ref="markRef"
        data-passage
        tabindex="0"
        class="sv-mark"
        :class="`sv-mark--${owner}`"
        :aria-expanded="open"
        aria-haspopup="dialog"
        @pointerenter="onPointerEnter"
        @pointerleave="onPointerLeave"
        @focus="show()"
        @blur="hideSoon"
        @click="show()"
        @keydown.enter.prevent="show()"
        @keydown.space.prevent="show()"
        @keydown.esc="onEscape"
      ><slot /></mark>
    </PopoverAnchor>
    <PopoverContent
      side="top"
      align="start"
      :side-offset="8"
      :collision-padding="12"
      class="sv-card-wrap"
      aria-label="About this passage"
      @open-auto-focus.prevent
      @close-auto-focus.prevent
      @interact-outside="onInteractOutside"
    >
      <div
        ref="cardRef"
        class="sv-card"
        @pointerenter="onCardEnter"
        @pointerleave="onPointerLeave"
        @focusout="hideSoon"
        @keydown.esc="onEscape"
      >
        <section v-if="finding.suggestion" class="sv-card-sec">
          <h4 class="sv-card-title">Suggested edit</h4>
          <dl class="sv-edit">
            <dt>Now</dt>
            <dd class="sv-edit-now">{{ finding.suggestion.before || finding.page_quote }}</dd>
            <dt>Proposed</dt>
            <dd class="sv-edit-new">{{ finding.suggestion.after }}</dd>
            <template v-if="finding.suggestion.why">
              <dt>Why</dt>
              <dd>{{ finding.suggestion.why }}</dd>
            </template>
          </dl>
          <button type="button" class="sv-copy" @click="copyProposed">
            <component :is="copied ? Check : Copy" :size="13" aria-hidden="true" />
            {{ copied ? 'Copied' : 'Copy proposed text' }}
          </button>
        </section>
        <section class="sv-card-sec">
          <h4 class="sv-card-title">Reference</h4>
          <p class="sv-ref-who">{{ engineLabel }} answered:</p>
          <blockquote class="sv-ref-quote">{{ finding.answer_quote }}</blockquote>
        </section>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>

<style scoped>
.sv-card-wrap {
  z-index: 70;
}
.sv-card {
  width: min(22rem, calc(100vw - 2rem));
  max-height: min(26rem, 70vh);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  font-size: 0.8125rem;
  line-height: 1.5;
}
.sv-card-sec {
  padding: 0.75rem 0.875rem;
}
.sv-card-sec + .sv-card-sec {
  border-top: 1px solid var(--border);
}
.sv-card-title {
  margin-bottom: 0.375rem;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.sv-edit {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.625rem;
}
.sv-edit dt {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
}
.sv-edit-now {
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--destructive) 60%, transparent);
  color: var(--muted-foreground);
}
.sv-edit-new {
  font-weight: 500;
}
.sv-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--foreground);
  background: var(--card);
}
.sv-copy:hover {
  background: var(--secondary);
}
.sv-copy:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.sv-ref-who {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.sv-ref-quote {
  margin-top: 0.25rem;
  border-left: 2px solid var(--border);
  padding-left: 0.625rem;
  font-style: italic;
}
</style>
