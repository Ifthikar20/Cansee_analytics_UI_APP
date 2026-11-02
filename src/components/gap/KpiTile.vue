<template>
  <div class="kpi">
    <span class="kpi-label">
      <span v-if="tone" class="kpi-dot" :style="{ background: tone }" aria-hidden="true"></span>
      {{ label }}
    </span>
    <span class="kpi-value">{{ value }}</span>
    <span v-if="hint" class="kpi-hint">{{ hint }}</span>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: '' },
  tone: { type: String, default: '' },
})
</script>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}

.kpi-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--muted-foreground);
  font-size: 13px;
  font-weight: 500;
}

.kpi-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.kpi-value {
  color: var(--foreground);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.kpi-hint {
  color: var(--muted-foreground);
  font-size: 12px;
}
</style>
