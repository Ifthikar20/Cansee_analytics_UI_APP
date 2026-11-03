<template>
  <span class="gap-badge" :style="{ '--tone': meta.color }" :title="meta.blurb">
    <span class="gap-badge-dot" aria-hidden="true"></span>
    {{ meta.label }}
    <span v-if="showValue && valueText" class="gap-badge-value">{{ valueText }}</span>
  </span>
</template>

<script setup>
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tone) 13%, transparent);
  color: var(--tone);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.gap-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tone);
}

.gap-badge-value {
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
</style>
