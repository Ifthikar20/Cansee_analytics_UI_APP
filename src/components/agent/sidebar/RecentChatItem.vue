<script setup>
// One recent chat: link, running spinner, unseen dot, and a menu with Rename
// (inline) and Delete (confirmed by the parent).
import { computed, nextTick, ref } from 'vue'
import { Ellipsis, Pencil, Trash2 } from '@lucide/vue'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { IconRecentChat } from '@/components/agent/icons'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'

const TITLE_MAX = 120

const props = defineProps({
  chat: { type: Object, required: true },
  websiteId: { type: String, required: true },
  active: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  unseen: { type: Boolean, default: false },
})

const emit = defineEmits(['rename', 'delete'])

const menuOpen = ref(false)
const editing = ref(false)
const draft = ref('')
const inputEl = ref(null)
const linkEl = ref(null)

const title = computed(() => (props.chat.title || '').trim() || 'New chat')
const to = computed(() => ({
  name: 'agent-chat',
  params: { websiteId: props.websiteId, chatId: String(props.chat.id) },
}))

function startRename() {
  draft.value = (props.chat.title || '').trim()
  editing.value = true
}

// The menu hands focus back to its trigger on close; the rename field takes it instead.
function onCloseAutoFocus(event) {
  if (!editing.value) return
  event.preventDefault()
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

function focusLink() {
  nextTick(() => {
    const el = linkEl.value?.$el || linkEl.value
    el?.focus?.()
  })
}

function commit() {
  if (!editing.value) return
  editing.value = false
  const next = draft.value.trim().slice(0, TITLE_MAX)
  if (next && next !== (props.chat.title || '').trim()) emit('rename', { chat: props.chat, title: next })
  focusLink()
}

function cancel() {
  if (!editing.value) return
  editing.value = false
  focusLink()
}

defineExpose({ startRename })
</script>

<template>
  <li class="ag-rc" :class="{ 'is-active': active, 'is-menu-open': menuOpen, 'is-editing': editing }">
    <div v-if="editing" class="ag-rc-row">
      <IconRecentChat class="ag-rc-icon" :size="16" />
      <input
        ref="inputEl"
        v-model="draft"
        class="ag-rc-input"
        type="text"
        :maxlength="TITLE_MAX"
        aria-label="Chat title"
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent.stop="cancel"
        @blur="commit"
      />
    </div>
    <router-link
      v-else
      ref="linkEl"
      :to="to"
      class="ag-rc-row ag-rc-link"
      :aria-current="active ? 'page' : undefined"
      :title="title"
    >
      <span class="ag-rc-lead">
        <AgSpinner v-if="busy" :size="14" />
        <IconRecentChat v-else class="ag-rc-icon" :size="16" />
      </span>
      <span class="ag-rc-title">{{ title }}</span>
      <span v-if="busy" class="ag-sr-only">(agent working)</span>
      <span v-else-if="unseen" class="ag-sr-only">(new reply)</span>
      <span v-if="unseen && !busy" class="ag-rc-dot" aria-hidden="true" />
    </router-link>

    <DropdownMenuRoot v-if="!editing" v-model:open="menuOpen" :modal="false">
      <DropdownMenuTrigger as-child>
        <AgIconButton class="ag-rc-more" :label="`Options for ${title}`" :tooltip="false" :size="24" :icon-size="16">
          <Ellipsis />
        </AgIconButton>
      </DropdownMenuTrigger>
      <AgMenuContent align="start" :width="180" @close-auto-focus="onCloseAutoFocus">
        <AgMenuItem @select="startRename">
          <Pencil aria-hidden="true" />
          Rename
        </AgMenuItem>
        <AgMenuItem danger @select="emit('delete', chat)">
          <Trash2 aria-hidden="true" />
          Delete
        </AgMenuItem>
      </AgMenuContent>
    </DropdownMenuRoot>
  </li>
</template>

<style scoped>
.ag-rc {
  position: relative;
  list-style: none;
}

.ag-rc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  height: 34px;
  padding: 0 8px;
  border-radius: var(--radius);
  color: var(--ag-fg-2);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.ag-rc-link {
  transition: background-color 120ms ease, color 120ms ease;
}

.ag-rc-link:hover,
.ag-rc.is-menu-open .ag-rc-link {
  background: var(--ag-row-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-rc.is-active .ag-rc-link,
.ag-rc.is-editing .ag-rc-row {
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-rc-link:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-rc-lead {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--ag-recent-icon);
}

.ag-rc-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--ag-recent-icon);
}

.ag-rc-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-rc-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-right: 2px;
  border-radius: 50%;
  background: var(--ag-accent);
}

/* Room for the options button while it shows. */
.ag-rc:hover .ag-rc-link,
.ag-rc:focus-within .ag-rc-link,
.ag-rc.is-menu-open .ag-rc-link {
  padding-right: 34px;
}

.ag-rc:hover .ag-rc-dot,
.ag-rc:focus-within .ag-rc-dot,
.ag-rc.is-menu-open .ag-rc-dot {
  display: none;
}

.ag-rc-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 26px;
  margin-right: -4px;
  padding: 0 6px;
  border: 1px solid var(--ag-composer-border);
  border-radius: var(--radius);
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  outline: none;
}

.ag-rc-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: var(--radius);
  outline: none;
}

/* The button is rendered by AgIconButton, so these reach it through :deep(). */
.ag-rc :deep(.ag-rc-more) {
  position: absolute;
  top: 5px;
  right: 6px;
  opacity: 0;
  pointer-events: none;
}

.ag-rc:hover :deep(.ag-rc-more),
.ag-rc:focus-within :deep(.ag-rc-more),
.ag-rc.is-menu-open :deep(.ag-rc-more) {
  opacity: 1;
  pointer-events: auto;
}

@media (pointer: coarse) {
  .ag-rc :deep(.ag-rc-more) {
    opacity: 1;
    pointer-events: auto;
  }

  .ag-rc .ag-rc-link {
    padding-right: 34px;
  }

  .ag-rc-dot {
    display: none;
  }
}
</style>
