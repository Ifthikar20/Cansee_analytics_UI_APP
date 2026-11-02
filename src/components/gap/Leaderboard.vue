<template>
  <div>
    <ol v-if="brands.length" class="lb">
      <li v-for="(b, i) in brands" :key="b.name" class="lb-row" :class="{ 'is-you': b.is_you }">
        <span class="lb-rank">{{ i + 1 }}</span>
        <span class="lb-avatar" :style="{ background: brandColor(b.name) }" aria-hidden="true">
          {{ brandInitial(b.name) }}
        </span>
        <span class="lb-name">
          {{ b.name }}
          <span v-if="b.is_you" class="lb-you">You</span>
        </span>
        <span class="lb-bar" aria-hidden="true"><span :style="{ width: `${b.visibility_pct}%` }"></span></span>
        <span class="lb-pct">{{ b.visibility_pct }}%</span>
      </li>
    </ol>
    <p v-else class="lb-empty">Brands appear here once the engines have answered your prompts.</p>
  </div>
</template>

<script setup>
// Share of the latest AI answers that name each brand, across every
// tracked prompt. Profound-style benchmark: where you stand in the field.
import { brandColor, brandInitial } from '@/lib/brandLogo'

defineProps({
  brands: { type: Array, required: true },
})
</script>

<style scoped>
.lb {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lb-row {
  display: grid;
  grid-template-columns: 18px 24px minmax(0, 1fr) 30% 40px;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 10px;
  font-size: 13.5px;
}

.lb-row.is-you {
  background: color-mix(in srgb, var(--gap-ai) 9%, transparent);
}

.lb-rank {
  color: var(--muted-foreground);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.lb-avatar {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}

.lb-name {
  overflow: hidden;
  color: var(--foreground);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-you {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--gap-ai);
  color: var(--card);
  font-size: 10.5px;
  font-weight: 700;
}

.lb-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--muted);
}

.lb-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--muted-foreground);
}

.lb-row.is-you .lb-bar span {
  background: var(--gap-ai);
}

.lb-pct {
  color: var(--foreground);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.lb-empty {
  color: var(--muted-foreground);
  font-size: 13px;
}
</style>
