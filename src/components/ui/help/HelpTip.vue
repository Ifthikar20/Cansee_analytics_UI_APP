<script setup>
// A toggletip: a small help icon (or the text in its slot) that shows one
// plain sentence of help. Unlike a tooltip it works on every input:
//   - hover opens it after the provider's delay, and leaving closes it;
//   - keyboard focus opens it, blur closes it;
//   - a click or a tap toggles it and keeps it open (reka's trigger
//     ignores touch, so the click is what makes it work on a phone);
//   - Escape and a press outside close it.
// The text is also always in the button's description, through a hidden
// span under <body>, so a screen reader reads it on focus whether the tip
// is open or not (reka sets aria-describedby only while the tip is open).
//
// Text only: the tip is not interactive, so it never holds a link.
// Works with or without a TooltipProvider above it (AppShell provides one),
// and stacks above the onboarding flow and dialogs (help.css).
//
//   <HelpTip text="How many times each engine gets the question." label="About Times per engine" />
//   <HelpTip :text="blurb">AI ahead</HelpTip>
import { computed, ref, useId, useSlots } from 'vue'
import { CircleHelp } from '@lucide/vue'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  injectTooltipProviderContext,
} from 'reka-ui'
import './help.css'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  text: { type: String, required: true },
  // The icon button's accessible name. Unused with slot text, which names it.
  label: { type: String, default: 'More about this' },
  side: { type: String, default: 'top' },
  align: { type: String, default: 'center' },
  sideOffset: { type: Number, default: 6 },
  iconSize: { type: Number, default: 14 },
  // The icon when there is no slot text (lucide CircleHelp by default).
  icon: { type: [Object, Function], default: null },
})

const slots = useSlots()
const hasText = computed(() => Boolean(slots.default))
const iconComponent = computed(() => props.icon || CircleHelp)

const hasProvider = Boolean(injectTooltipProviderContext(null))
const Passthrough = (_, { slots: inner }) => inner.default?.()
const providerProps = hasProvider ? {} : { delayDuration: 400, skipDelayDuration: 200 }

const descId = `cs-help-${useId()}`
const open = ref(false)
// Opened by a click or a tap: stays open until a second click, Escape, a
// press outside or blur, not when the pointer leaves.
const pinned = ref(false)

function close() {
  pinned.value = false
  open.value = false
}

function toggle() {
  if (open.value && pinned.value) {
    close()
    return
  }
  pinned.value = true
  open.value = true
}

// A press on the trigger itself is the toggle's (the click that follows),
// not an outside press.
function onPointerDownOutside(event) {
  const target = event?.target
  if (target instanceof Element && target.closest(`[data-cs-helptip="${descId}"]`)) return
  close()
}

// Hover, focus and the dismiss layer ask through here.
function onRootOpen(value) {
  if (value) open.value = true
  else if (!pinned.value) open.value = false
}

</script>

<template>
  <component :is="hasProvider ? Passthrough : TooltipProvider" v-bind="providerProps">
    <TooltipRoot
      :open="open"
      :disable-closing-trigger="true"
      :ignore-non-keyboard-focus="true"
      @update:open="onRootOpen"
    >
      <TooltipTrigger as-child>
        <button
          v-bind="$attrs"
          type="button"
          class="cs-helptip"
          :class="{ 'has-text': hasText }"
          :aria-label="hasText ? undefined : label"
          :aria-describedby="descId"
          :data-cs-helptip="descId"
          :style="{ '--cs-helptip-icon': `${iconSize}px` }"
          @click="toggle"
          @blur="close"
        >
          <slot>
            <component :is="iconComponent" aria-hidden="true" />
          </slot>
        </button>
      </TooltipTrigger>
      <!-- Under <body>, so the text stays out of the surrounding copy. -->
      <Teleport to="body">
        <span :id="descId" hidden>{{ text }}</span>
      </Teleport>
      <TooltipPortal>
        <TooltipContent
          class="cs-tooltip cs-helptip-content"
          :side="side"
          :align="align"
          :side-offset="sideOffset"
          :collision-padding="8"
          @escape-key-down="close"
          @pointer-down-outside="onPointerDownOutside"
        >
          {{ text }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </component>
</template>
