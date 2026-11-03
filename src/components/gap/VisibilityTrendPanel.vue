<template>
  <VizChart
    :spec="spec"
    :loading="pending"
    :error="error ? 'We couldn\'t load the trend.' : ''"
    :empty="empty"
    :heading-level="2"
    @retry="emit('retry')"
  >
    <template v-if="websiteId" #actions>
      <router-link :to="{ name: 'visibility', params: { websiteId } }" class="vtp-link">
        Open Visibility
        <ArrowRight class="vtp-link-icon" aria-hidden="true" />
      </router-link>
    </template>
  </VizChart>
</template>

<script setup>
// The Overview's AI visibility trend: the visibility dashboard's last 30
// days, one line per engine, with a way into the Visibility page. The
// page loads the payload after the overview, so this never blocks it.
import { computed } from 'vue'
import { ArrowRight } from '@lucide/vue'
import VizChart from '@/components/charts/VizChart.vue'
import { visibilityOverTime } from '@/lib/analytics/visibilitySpecs'

const props = defineProps({
  websiteId: { type: String, default: '' },
  // The visibility dashboard payload for the last 30 days (contract 5).
  payload: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
})
const emit = defineEmits(['retry'])

const spec = computed(() =>
  visibilityOverTime(props.payload, {
    id: 'overview.trend',
    title: 'AI visibility over time',
    subtitle: 'Share of answers that name you, last 30 days, by engine.',
  }),
)

const pending = computed(() => props.loading || (!props.payload && !props.error))

const empty = computed(() =>
  props.payload && props.payload.has_data === false ? { title: 'No AI answers in the last 30 days.' } : null,
)
</script>

<style scoped>
.vtp-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.vtp-link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.vtp-link-icon {
  width: 14px;
  height: 14px;
}
</style>
