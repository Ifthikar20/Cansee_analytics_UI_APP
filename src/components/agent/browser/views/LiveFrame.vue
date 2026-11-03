<template>
  <div class="ag-live">
    <iframe
      :key="frameKey"
      ref="frame"
      class="ag-live-frame"
      :src="url"
      :title="title ? `Live page: ${title}` : 'Live page'"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="no-referrer"
      credentialless
      allow=""
      loading="lazy"
      @load="onLoad"
    />
    <div v-if="!loaded" class="ag-live-veil" role="status">
      <span class="ag-live-spinner" aria-hidden="true" />
      <span>{{ slow ? 'Still loading. Switch to Reader if the page stays blank.' : 'Loading the live page…' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// A third-party page shown live. allow-same-origin is safe only because the
// URL is never the app's own site (canFrameLive checks that before this
// renders). A frame blocked by the app's own CSP (frame-src) reports a
// securitypolicyviolation, which hands the tab to the reader view.

const props = defineProps({
  url: { type: String, required: true },
  title: { type: String, default: '' },
  nonce: { type: [Number, String], default: 0 },
})

const emit = defineEmits(['blocked', 'loaded'])

const loaded = ref(false)
const slow = ref(false)
let slowTimer = null

const frameKey = computed(() => `${props.url}#${props.nonce}`)

function origin(url) {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function armTimer() {
  clearTimeout(slowTimer)
  slow.value = false
  slowTimer = setTimeout(() => {
    slow.value = true
  }, 12_000)
}

function onLoad() {
  loaded.value = true
  clearTimeout(slowTimer)
  emit('loaded')
}

function onViolation(event) {
  const directive = String(event.effectiveDirective || event.violatedDirective || '')
  if (!/^(frame-src|child-src|default-src)/.test(directive)) return
  const blocked = String(event.blockedURI || '')
  const target = origin(props.url)
  if (target && (blocked === props.url || blocked.startsWith(target))) emit('blocked')
}

watch(frameKey, () => {
  loaded.value = false
  armTimer()
})

onMounted(() => {
  armTimer()
  document.addEventListener('securitypolicyviolation', onViolation)
})

onBeforeUnmount(() => {
  clearTimeout(slowTimer)
  document.removeEventListener('securitypolicyviolation', onViolation)
})
</script>

<style scoped>
.ag-live {
  position: relative;
  width: 100%;
  height: 100%;
  background: #ffffff;
}

.ag-live-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

.ag-live-veil {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  background: var(--ag-pane-bg);
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 20px;
  text-align: center;
}

.ag-live-spinner {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--ag-fg-disabled);
  border-top-color: var(--ag-fg-2);
  border-radius: 50%;
  animation: ag-spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ag-live-spinner {
    animation: none;
  }
}
</style>
