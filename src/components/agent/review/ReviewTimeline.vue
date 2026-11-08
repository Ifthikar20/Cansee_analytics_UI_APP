<script setup>
// What happened in a draft's review, oldest first: requests, decisions,
// withdrawals, reopenings and comments, with whether an email went out.
// Notes and comments are people's text, rendered as text only.
import { computed } from 'vue'
import { relativeTime } from '@/components/agent/common/agentText'
import { emailLine, eventLine } from '@/lib/agent/review'

const props = defineProps({
  events: { type: Array, default: () => [] },
})

const rows = computed(() =>
  props.events
    .filter((e) => e && e.kind)
    .map((e, i) => ({
      key: e.id || `${e.kind}-${i}`,
      comment: e.kind === 'comment',
      actor: e.actor_name || 'Someone',
      line: eventLine(e),
      body: String(e.body || '').trim(),
      email: emailLine(e),
      at: e.created_at || '',
    })),
)
</script>

<template>
  <ol v-if="rows.length" class="ag-rtl" aria-label="Review history">
    <li v-for="row in rows" :key="row.key" class="ag-rtl-item">
      <p class="ag-rtl-line">
        <template v-if="row.comment"><span class="ag-rtl-actor">{{ row.actor }}</span></template>
        <template v-else>{{ row.line }}</template>
        <template v-if="row.email"> <span class="ag-rtl-email">{{ row.email }}</span></template>
      </p>
      <p v-if="row.body" class="ag-rtl-body">{{ row.body }}</p>
      <time v-if="relativeTime(row.at)" class="ag-rtl-time" :datetime="row.at">{{ relativeTime(row.at) }}</time>
    </li>
  </ol>
</template>

<style scoped>
.ag-rtl {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0 0 0 12px;
  border-left: 1px solid var(--ag-divider);
  list-style: none;
}

.ag-rtl-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ag-rtl-line {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 19px;
}

.ag-rtl-actor {
  font-weight: 500;
}

.ag-rtl-email {
  color: var(--ag-fg-3);
}

.ag-rtl-body {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-rtl-time {
  color: var(--ag-fg-4);
  font-size: 12px;
  line-height: 16px;
}
</style>
