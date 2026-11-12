<template>
  <div class="ag-perr" role="alert">
    <CircleAlert class="ag-perr-icon" :size="20" aria-hidden="true" />
    <p class="ag-perr-title">{{ title }}</p>
    <p v-if="body" class="ag-perr-body">{{ body }}</p>
    <div v-if="retry || href" class="ag-perr-actions">
      <button v-if="retry" type="button" class="ag-perr-btn" @click="emit('retry')">
        <RotateCw :size="14" aria-hidden="true" />
        Try again
      </button>
      <a
        v-if="href"
        class="ag-perr-btn is-ghost"
        :href="href"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        <ExternalLink :size="14" aria-hidden="true" />
        Open in new window
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CircleAlert, ExternalLink, RotateCw } from '@lucide/vue'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  url: { type: String, default: '' },
  retry: { type: Boolean, default: false },
})

const emit = defineEmits(['retry'])

const href = computed(() => safeHref(props.url))
</script>

<style scoped>
.ag-perr {
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  max-width: 420px;
  margin: 0 auto;
  padding: 56px 24px;
  text-align: center;
}

.ag-perr-icon {
  color: var(--ag-danger);
}

.ag-perr-title {
  margin: 12px 0 0;
  color: var(--ag-fg-1);
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
}

.ag-perr-body {
  margin: 6px 0 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.ag-perr-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
}

.ag-perr-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ag-btn-border);
  border-radius: var(--radius);
  background: var(--ag-btn-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.ag-perr-btn:hover {
  background: var(--ag-btn-hover);
  opacity: 1;
}

.ag-perr-btn.is-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ag-fg-2);
}

.ag-perr-btn.is-ghost:hover {
  background: var(--ag-ghost-hover);
  color: var(--ag-fg-1);
}

.ag-perr-btn:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}
</style>
