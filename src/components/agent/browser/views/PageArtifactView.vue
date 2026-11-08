<template>
  <div class="ag-pav" :aria-busy="live ? 'true' : 'false'">
    <iframe
      v-for="i in 2"
      :key="i"
      class="ag-pav-frame"
      :class="{ 'is-front': front === i - 1 }"
      :srcdoc="docs[i - 1]"
      sandbox=""
      referrerpolicy="no-referrer"
      :title="front === i - 1 ? frameTitle : `${frameTitle} (next update)`"
      :aria-hidden="front === i - 1 ? undefined : 'true'"
      :tabindex="front === i - 1 ? 0 : -1"
      @load="onLoad(i - 1)"
    />
    <div v-if="live && !html" class="ag-pav-wait" role="status">
      <AgSpinner :size="14" />
      Drafting the page…
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { useThrottledSrcdoc } from '@/composables/agent/useThrottledSrcdoc'

// Generated landing pages run in sandbox="" frames (no scripts, no forms, no
// same-origin access) with an injected CSP. While the agent drafts, the
// preview rebuilds at most every 700 ms into the hidden frame and swaps on
// load.

const props = defineProps({
  html: { type: String, default: '' },
  live: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

const { docs, front, onLoad } = useThrottledSrcdoc(() => props.html, { live: () => props.live })

const frameTitle = computed(() => (props.title ? `Preview of ${props.title}` : 'Page preview'))
</script>

<style scoped>
.ag-pav {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}

.ag-pav-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
  visibility: hidden;
}

.ag-pav-frame.is-front {
  visibility: visible;
}

.ag-pav-wait {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
}
</style>
