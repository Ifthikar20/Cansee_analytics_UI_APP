<script setup>
// A board card's options (board_contract.md 9): Expand, Move up, Move
// down, Size (the sizes the widget allows) and Remove from board. Move up
// and Move down are the single-pointer and screen-reader way to arrange the
// board; cards also move by drag and drop and by the grip's keys
// (frame_board.md B3 and B4). After an action the card decides where focus
// goes, so the menu's own return to the trigger is skipped then; Escape and
// a click outside return to the trigger as usual.
import { computed } from 'vue'
import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'reka-ui'
import { ArrowDown, ArrowUp, Check, ChevronRight, CircleMinus, Columns3, Maximize2, MoreHorizontal } from '@lucide/vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuSeparator from '@/components/agent/common/AgMenuSeparator.vue'
import AgMenuSubContent from '@/components/agent/common/AgMenuSubContent.vue'
import { SIZE_LABELS } from '@/lib/board/widgets'

const props = defineProps({
  title: { type: String, required: true },
  index: { type: Number, required: true },
  count: { type: Number, required: true },
  size: { type: String, required: true },
  sizes: { type: Array, default: () => [] },
})

const emit = defineEmits(['expand', 'move', 'resize', 'remove'])

const sizeOptions = computed(() => props.sizes.map((value) => ({ value, label: SIZE_LABELS[value] || value })))

// Set by an item, read when the menu closes.
let handled = false

function act(name, ...args) {
  handled = true
  emit(name, ...args)
}

// Picking the current size changes nothing; focus returns to the trigger.
function onResize(value) {
  if (value && value !== props.size) act('resize', value)
}

function onCloseAutoFocus(event) {
  if (handled) event.preventDefault()
  handled = false
}
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <AgIconButton class="bd-card-menu" :label="`Options for ${title}`" :size="28" muted>
        <MoreHorizontal :size="16" aria-hidden="true" />
      </AgIconButton>
    </DropdownMenuTrigger>
    <AgMenuContent align="end" :width="200" @close-auto-focus="onCloseAutoFocus">
      <AgMenuItem @select="act('expand')">
        <Maximize2 aria-hidden="true" />
        <span class="ag-menu-text">Expand</span>
      </AgMenuItem>
      <AgMenuItem :disabled="index <= 0" @select="act('move', -1)">
        <ArrowUp aria-hidden="true" />
        <span class="ag-menu-text">Move up</span>
      </AgMenuItem>
      <AgMenuItem :disabled="index >= count - 1" @select="act('move', 1)">
        <ArrowDown aria-hidden="true" />
        <span class="ag-menu-text">Move down</span>
      </AgMenuItem>
      <DropdownMenuSub v-if="sizeOptions.length > 1">
        <DropdownMenuSubTrigger class="ag-menu-item">
          <Columns3 aria-hidden="true" />
          <span class="ag-menu-text">Size</span>
          <span class="ag-menu-trail">
            <ChevronRight :size="16" aria-hidden="true" />
          </span>
        </DropdownMenuSubTrigger>
        <AgMenuSubContent>
          <DropdownMenuRadioGroup :model-value="size" @update:model-value="onResize">
            <DropdownMenuRadioItem v-for="o in sizeOptions" :key="o.value" :value="o.value" class="ag-menu-item">
              <span class="ag-menu-text">{{ o.label }}</span>
              <span class="ag-menu-trail">
                <DropdownMenuItemIndicator>
                  <Check :size="16" aria-hidden="true" />
                </DropdownMenuItemIndicator>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </AgMenuSubContent>
      </DropdownMenuSub>
      <AgMenuSeparator />
      <AgMenuItem danger @select="act('remove')">
        <CircleMinus aria-hidden="true" />
        <span class="ag-menu-text">Remove from board</span>
      </AgMenuItem>
    </AgMenuContent>
  </DropdownMenuRoot>
</template>
