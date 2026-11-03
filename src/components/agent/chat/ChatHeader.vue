<template>
  <header class="ag-chat-head">
    <div class="ag-chat-head-start">
      <AgIconButton
        v-if="ui.showSidebarToggle"
        :label="ui.docked ? 'Show sidebar' : 'Open menu'"
        shortcut="mod+b"
        :size="28"
        class="ag-chat-head-sidebar"
        @click="ui.toggleSidebar()"
      >
        <IconPanelLeft />
      </AgIconButton>

      <form v-if="renaming" class="ag-chat-rename" @submit.prevent="saveRename">
        <label :for="renameId" class="ag-sr-only">Chat name</label>
        <input
          :id="renameId"
          ref="renameField"
          v-model="renameValue"
          class="ag-chat-rename-input"
          maxlength="120"
          @keydown.esc.prevent="cancelRename"
          @blur="saveRename"
        />
      </form>

      <h1 v-else-if="!chatId" class="ag-chat-title">
        <span class="ag-chat-title-text">{{ displayTitle }}</span>
      </h1>

      <h1 v-else class="ag-chat-title">
        <DropdownMenuRoot :modal="false">
          <DropdownMenuTrigger as-child>
            <button type="button" class="ag-chat-title-btn" :aria-label="`${displayTitle}, chat options`">
              <span class="ag-chat-title-text">{{ displayTitle }}</span>
              <ChevronDown class="ag-chat-title-chevron" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <AgMenuContent align="start" :width="200">
            <AgMenuItem @select="startRename">
              <SquarePen aria-hidden="true" />
              <span class="ag-menu-text">Rename</span>
            </AgMenuItem>
            <AgMenuItem @select="copyLink">
              <Link aria-hidden="true" />
              <span class="ag-menu-text">Copy link</span>
            </AgMenuItem>
            <AgMenuSeparator />
            <AgMenuItem danger @select="confirmOpen = true">
              <Trash2 aria-hidden="true" />
              <span class="ag-menu-text">Delete</span>
            </AgMenuItem>
          </AgMenuContent>
        </DropdownMenuRoot>
      </h1>
    </div>

    <div class="ag-chat-head-end">
      <AgIconButton
        v-if="!pane.open && pane.hasTabs"
        label="Show browser"
        shortcut="mod+\"
        :size="32"
        muted
        @click="pane.setOpen(true, { returnFocus: $event.currentTarget })"
      >
        <IconPanelRight />
      </AgIconButton>
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <AgIconButton label="More" :size="32" :icon-size="20" muted>
            <Ellipsis />
          </AgIconButton>
        </DropdownMenuTrigger>
        <AgMenuContent align="end" :width="220">
          <AgMenuItem @select="newChat">
            <SquarePen aria-hidden="true" />
            <span class="ag-menu-text">New chat</span>
            <template #trail><span class="ag-chat-kbd">{{ newChatKeys }}</span></template>
          </AgMenuItem>
          <AgMenuItem @select="showBrowser">
            <IconPanelRight aria-hidden="true" />
            <span class="ag-menu-text">Show browser</span>
          </AgMenuItem>
          <AgMenuItem :disabled="!messages.length" @select="exportTranscript">
            <Download aria-hidden="true" />
            <span class="ag-menu-text">Export transcript (.md)</span>
          </AgMenuItem>
        </AgMenuContent>
      </DropdownMenuRoot>
    </div>

    <AgConfirmDialog
      v-model:open="confirmOpen"
      title="Delete this chat?"
      :description="`“${displayTitle}” and its messages will be deleted. Saved reports and drafted pages stay in the project.`"
      confirm-label="Delete"
      busy-label="Deleting"
      destructive
      :busy="deleting"
      :error="deleteError"
      @confirm="deleteChat"
      @cancel="deleteError = ''"
    />
  </header>
</template>

<script setup>
// Chat header: sidebar button (collapsed or narrow layouts), the title with
// its menu (Rename, Copy link, Delete), the browser button when the pane is
// closed but has tabs, and the "..." menu.
import { computed, nextTick, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { ChevronDown, Download, Ellipsis, Link, SquarePen, Trash2 } from '@lucide/vue'
import AgConfirmDialog from '@/components/agent/common/AgConfirmDialog.vue'
import AgIconButton from '@/components/agent/common/AgIconButton.vue'
import AgMenuContent from '@/components/agent/common/AgMenuContent.vue'
import AgMenuItem from '@/components/agent/common/AgMenuItem.vue'
import AgMenuSeparator from '@/components/agent/common/AgMenuSeparator.vue'
import { IconPanelLeft, IconPanelRight } from '@/components/agent/icons'
import { transcriptMarkdown } from './thread'
import { errorInfo } from '@/components/agent/message/parts'
import { copyText, downloadText, safeFilename } from '@/lib/agent/download'
import { formatShortcut } from '@/composables/agent/usePlatform'
import { useAgentStore } from '@/stores/agent'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentUiStore } from '@/stores/agentUi'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  chatId: { type: String, default: null },
  websiteId: { type: [String, Number], required: true },
  title: { type: String, default: '' },
  projectName: { type: String, default: '' },
  messages: { type: Array, default: () => [] },
})

const router = useRouter()
const store = useAgentStore()
const pane = useAgentPaneStore()
const ui = useAgentUiStore()
const toast = useToast()

const renameId = `ag-rename-${useId()}`
const renaming = ref(false)
const renameValue = ref('')
const renameField = ref(null)
const confirmOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const newChatKeys = formatShortcut('mod+shift+o')

const displayTitle = computed(() => props.title?.trim() || 'New chat')

function startRename() {
  renameValue.value = props.title || ''
  renaming.value = true
  nextTick(() => {
    renameField.value?.focus()
    renameField.value?.select()
  })
}

function cancelRename() {
  renaming.value = false
}

async function saveRename() {
  if (!renaming.value) return
  renaming.value = false
  const next = renameValue.value.trim()
  if (!next || next === (props.title || '').trim() || !props.chatId) return
  try {
    await store.renameChat(props.chatId, next)
    ui.announce('Chat renamed')
  } catch (error) {
    toast.error(errorInfo(error).message || 'The chat could not be renamed.')
  }
}

function chatLink() {
  try {
    const { href } = router.resolve({ name: 'agent-chat-link', params: { chatId: props.chatId } })
    return new URL(href, window.location.origin).href
  } catch {
    return window.location.href.split('?')[0]
  }
}

async function copyLink() {
  const ok = await copyText(chatLink())
  if (ok) ui.announce('Link copied')
  else toast.error('The link could not be copied.')
}

async function deleteChat() {
  if (!props.chatId || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await store.deleteChat(props.chatId)
    confirmOpen.value = false
    ui.announce('Chat deleted')
    router.replace({ name: 'agent-home', params: { websiteId: String(props.websiteId) } })
  } catch (error) {
    deleteError.value = errorInfo(error).message || 'The chat could not be deleted. Try again.'
  } finally {
    deleting.value = false
  }
}

function newChat() {
  router.push({ name: 'agent-home', params: { websiteId: String(props.websiteId) } }).then(() => ui.focusComposer())
}

function showBrowser() {
  if (pane.hasTabs) pane.setOpen(true)
  else pane.openNewTab()
}

function exportTranscript() {
  const text = transcriptMarkdown({ title: displayTitle.value, project: props.projectName, messages: props.messages })
  downloadText(text, safeFilename(displayTitle.value, 'md'), 'text/markdown;charset=utf-8')
}
</script>

<style scoped>
.ag-chat-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  background: var(--ag-pane-bg);
}

.ag-chat-head-start {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ag-chat-head-sidebar {
  margin-left: -6px;
}

/* The kebab sits 16px from the edge: a 32px button centred 32px in. */
.ag-chat-head-end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.ag-chat-title {
  display: flex;
  min-width: 0;
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.ag-chat-title-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 28px;
  margin-left: -6px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-chat-title-btn:hover,
.ag-chat-title-btn[data-state='open'] {
  background: var(--ag-ghost-hover);
}

.ag-chat-title-btn:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 1px;
  border-radius: 6px;
}

.ag-chat-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-chat-title-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ag-fg-chevron);
}

.ag-chat-rename {
  display: flex;
  flex: 1;
  min-width: 0;
  max-width: 360px;
}

.ag-chat-rename-input {
  width: 100%;
  height: 28px;
  margin-left: -6px;
  padding: 0 6px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 6px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
}

.ag-chat-rename-input:focus-visible {
  outline: 2px solid var(--ag-ring);
  outline-offset: 0;
  border-radius: 6px;
}

.ag-chat-kbd {
  color: var(--ag-fg-4);
  font-size: 12px;
}
</style>
