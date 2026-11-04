<script setup>
// Inbox button with the activity popover. Activity loads when the popover
// opens, and once quietly per project so a dot can mark items newer than the
// last time the inbox was opened.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Inbox } from '@lucide/vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import { asList, errorMessage } from '@/components/agent/common/agentText'
import ActivityPopover from './ActivityPopover.vue'

const PREFETCH_DELAY_MS = 1500

const props = defineProps({
  websiteId: { type: String, default: null },
})

const agent = useAgentStore()
const ui = useAgentUiStore()

const open = ref(false)
const loading = ref(false)
const error = ref('')
const fetched = ref(null)

const items = computed(() => {
  const fromStore = asList(agent.activity)
  if (fromStore.length || !Array.isArray(fetched.value)) return fromStore
  return fetched.value
})

const newest = computed(() => {
  let best = null
  for (const item of items.value) {
    const t = Date.parse(item?.at)
    if (!Number.isNaN(t) && (best === null || t > best.t)) best = { t, at: item.at }
  }
  return best
})

const hasNew = computed(() => {
  if (!props.websiteId || !newest.value) return false
  const seen = Date.parse(ui.activitySeenAtFor(props.websiteId))
  return Number.isNaN(seen) || newest.value.t > seen
})

const label = computed(() => (hasNew.value ? 'Activity, new items' : 'Activity'))

async function load({ quiet = false } = {}) {
  if (!props.websiteId || typeof agent.loadActivity !== 'function') return
  loading.value = true
  if (!quiet) error.value = ''
  try {
    const result = await agent.loadActivity()
    fetched.value = Array.isArray(result) ? result : asList(result)
    error.value = ''
  } catch (err) {
    if (!quiet) error.value = errorMessage(err, "Couldn't load activity.")
  } finally {
    loading.value = false
  }
}

function markSeen() {
  if (props.websiteId && newest.value) ui.markActivitySeen(props.websiteId, newest.value.at)
}

watch(open, async (value) => {
  if (!value) {
    markSeen()
    return
  }
  await load()
  markSeen()
})

let prefetchTimer = null
watch(
  () => props.websiteId,
  (wid) => {
    clearTimeout(prefetchTimer)
    fetched.value = null
    error.value = ''
    if (!wid) return
    prefetchTimer = setTimeout(() => {
      if (!open.value && String(agent.websiteId ?? '') === wid) load({ quiet: true })
    }, PREFETCH_DELAY_MS)
  },
  { immediate: true },
)

onBeforeUnmount(() => clearTimeout(prefetchTimer))
</script>

<template>
  <PopoverRoot v-model:open="open">
    <span class="ag-act-anchor">
      <PopoverTrigger as-child>
        <AgIconButton :label="label" :tooltip="open ? false : 'Activity'" tooltip-side="top" :disabled="!websiteId">
          <Inbox />
        </AgIconButton>
      </PopoverTrigger>
      <span v-if="hasNew && !open" class="ag-act-dot" aria-hidden="true" />
    </span>
    <PopoverPortal>
      <PopoverContent
        class="ag-portal ag-popover"
        side="top"
        align="start"
        :side-offset="6"
        :collision-padding="8"
      >
        <ActivityPopover
          :items="items"
          :website-id="websiteId"
          :loading="loading"
          :error="error"
          @retry="load()"
          @navigate="open = false"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.ag-act-anchor {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.ag-act-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 6px;
  height: 6px;
  border: 1.5px solid var(--ag-sidebar-bg);
  border-radius: 999px;
  background: var(--ag-accent);
  box-sizing: content-box;
  pointer-events: none;
}
</style>
