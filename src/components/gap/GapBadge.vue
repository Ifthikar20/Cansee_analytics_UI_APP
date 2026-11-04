<template>
  <span class="gap-badge" :title="meta.blurb">
    {{ meta.label }}
    <span v-if="showValue && valueText" class="gap-badge-value">{{ valueText }}</span>
  </span>
</template>

<script setup>
// A gap class in words, with its value when asked: "AI ahead +40",
// "Not definite". Plain text, no colour: the words carry the class.
import { computed } from 'vue'
import { gapDisplay, gapMeta, gapValue, gapValueText } from '@/lib/gap'

const props = defineProps({
  cls: { type: String, default: 'no_data' },
  value: { type: Number, default: null },
  showValue: { type: Boolean, default: false },
  // The API's gap object. When given it wins over cls and value, so a gap
  // whose Google side is a range shows "Not definite" or "≥ +45".
  gap: { type: Object, default: null },
})

const meta = computed(() => (props.gap ? gapDisplay(props.gap) : gapMeta(props.cls)))
const valueText = computed(() => (props.gap ? gapValueText(props.gap) : gapValue(props.value)))
</script>

<style scoped>
.gap-badge {
  color: inherit;
  font-size: inherit;
  font-weight: 500;
  white-space: nowrap;
}

.gap-badge-value {
  color: var(--muted-foreground);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
</style>
