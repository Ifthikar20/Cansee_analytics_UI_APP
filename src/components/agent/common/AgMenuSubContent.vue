<script setup>
// Submenu surface for AgMenuContent (inside a reka DropdownMenuSub).
import { DropdownMenuPortal, DropdownMenuSubContent } from 'reka-ui'

defineProps({
  sideOffset: { type: Number, default: 4 },
  alignOffset: { type: Number, default: -5 },
})
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuSubContent
      class="ag-portal ag-menu"
      :side-offset="sideOffset"
      :align-offset="alignOffset"
      :collision-padding="8"
      :loop="true"
    >
      <slot />
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>
