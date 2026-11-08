<script setup>
// Agent tooltip. Wraps one focusable trigger (as-child) and shows `text`
// plus an optional shortcut. Opens on hover and on keyboard focus only, so a
// menu returning focus to its trigger does not pop the tooltip. Works with or
// without a TooltipProvider above it (the shell provides one).
//
// The trigger keeps the same element whether the tooltip is enabled or not:
// toggling `disabled` (or emptying `text`) never re-creates it, so a menu or
// popover anchored to the trigger stays in place.
import { computed } from 'vue'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  injectTooltipProviderContext,
} from 'reka-ui'
import { shortcutLabels } from '@/composables/agent/usePlatform'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  text: { type: String, default: '' },
  // Aliases, so callers can write content= or label= as well.
  content: { type: String, default: '' },
  label: { type: String, default: '' },
  shortcut: { type: [String, Array], default: '' },
  side: { type: String, default: 'bottom' },
  align: { type: String, default: 'center' },
  sideOffset: { type: Number, default: 6 },
  delay: { type: Number, default: undefined },
  disabled: { type: Boolean, default: false },
  open: { type: Boolean, default: undefined },
})

const emit = defineEmits(['update:open'])

const hasProvider = Boolean(injectTooltipProviderContext(null))
const Passthrough = (_, { slots }) => slots.default?.()
const providerProps = hasProvider ? {} : { delayDuration: 400, skipDelayDuration: 200 }

const message = computed(() => props.text || props.content || props.label)
const keys = computed(() => shortcutLabels(props.shortcut))
const active = computed(() => !props.disabled && Boolean(message.value || keys.value.length))
</script>

<template>
  <component :is="hasProvider ? Passthrough : TooltipProvider" v-bind="providerProps">
    <TooltipRoot
      :open="open"
      :delay-duration="delay"
      :disabled="!active"
      :ignore-non-keyboard-focus="true"
      @update:open="emit('update:open', $event)"
    >
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal v-if="active">
        <TooltipContent
          v-bind="$attrs"
          class="ag-portal ag-tooltip"
          :side="side"
          :align="align"
          :side-offset="sideOffset"
          :collision-padding="8"
        >
          <span>{{ message }}</span>
          <span v-if="keys.length" class="ag-tooltip-keys" aria-hidden="true">
            <span v-for="(key, i) in keys" :key="i">{{ key }}</span>
          </span>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </component>
</template>
