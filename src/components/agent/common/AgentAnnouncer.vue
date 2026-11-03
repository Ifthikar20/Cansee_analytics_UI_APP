<script setup>
// The workspace's live regions. The chat thread is role=log with
// aria-live=off, so streaming tokens are silent; this component speaks run
// milestones for the open chat (working, sub-agent runs, the first 400
// characters of the reply, errors) and anything passed to agentUi.announce().
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAgentStore } from '@/stores/agent'
import { useAgentUiStore } from '@/stores/agentUi'
import { plainText } from './agentText'

const ui = useAgentUiStore()
const agent = useAgentStore()
const route = useRoute()

const ACTIVE = new Set(['queued', 'running', 'cancelling'])
const TERMINAL = new Set(['done', 'cancelled', 'failed'])

const lastPhase = new Map()
const announcedCalls = new Set()

function runList() {
  const runs = agent.runs
  if (!runs || typeof runs !== 'object') return []
  return Object.values(runs).filter((run) => run && run.id)
}

function concerned(run) {
  const open = route.params?.chatId
  return !open || !run.chatId || String(run.chatId) === String(open)
}

function replyText(run) {
  const message = agent.messages?.[run.messageId]
  const parts = Array.isArray(message?.parts) ? message.parts : []
  return {
    status: message?.status,
    text: parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n\n'),
  }
}

function speakTransition(run, before) {
  if (!concerned(run)) return
  const phase = run.phase
  if (ACTIVE.has(phase) && phase !== 'cancelling' && !ACTIVE.has(before)) {
    ui.announce('Agent is working')
    return
  }
  if (phase === 'done') {
    const { status, text } = replyText(run)
    if (status === 'refused') ui.announce('The agent declined this request.')
    else {
      const snippet = plainText(text, 400)
      ui.announce(snippet ? `Agent replied: ${snippet}` : 'Agent finished')
    }
  } else if (phase === 'failed') {
    const detail = run.error?.message ? ` ${run.error.message}` : ''
    ui.announce(`The agent stopped with an error.${detail}`, 'assertive')
  } else if (phase === 'cancelled') {
    ui.announce('Agent stopped')
  }
}

const phaseKey = computed(() =>
  runList()
    .map((run) => `${run.id}:${run.phase}`)
    .join('|'),
)

watch(phaseKey, () => {
  for (const run of runList()) {
    const before = lastPhase.get(run.id)
    if (before === run.phase) continue
    lastPhase.set(run.id, run.phase)
    // A run first seen already finished was loaded from history: stay quiet.
    if (before === undefined && TERMINAL.has(run.phase)) continue
    speakTransition(run, before)
  }
})

const callKey = computed(() => {
  const out = []
  for (const run of runList()) {
    if (TERMINAL.has(run.phase) || !concerned(run)) continue
    const parts = agent.messages?.[run.messageId]?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (part?.type === 'agent_call' && part.id) out.push(`${part.id}:${part.status || ''}:${part.agent_name ? 1 : 0}`)
    }
  }
  return out.join('|')
})

watch(callKey, () => {
  for (const run of runList()) {
    if (TERMINAL.has(run.phase) || !concerned(run)) continue
    const parts = agent.messages?.[run.messageId]?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (part?.type !== 'agent_call' || !part.id) continue
      const name = part.agent_name || 'Sub-agent'
      // The part arrives before the backend names the agent; wait for the name.
      if (!announcedCalls.has(part.id) && (part.agent_name || part.status !== 'preparing')) {
        announcedCalls.add(part.id)
        ui.announce(`Running ${name}`)
      }
      if (part.status === 'error' && !announcedCalls.has(`${part.id}:error`)) {
        announcedCalls.add(`${part.id}:error`)
        // The backend sends a sub-agent's error as a plain string.
        const detail = typeof part.error === 'string' ? part.error : part.error?.message || ''
        ui.announce(`${name} failed${detail ? `: ${detail}` : ''}`, 'assertive')
      }
    }
  }
})
</script>

<template>
  <div class="ag-sr-only" role="status" aria-live="polite" aria-atomic="true">
    <span :key="ui.politeAnnouncement.id">{{ ui.politeAnnouncement.text }}</span>
  </div>
  <div class="ag-sr-only" role="alert" aria-live="assertive" aria-atomic="true">
    <span :key="ui.assertiveAnnouncement.id">{{ ui.assertiveAnnouncement.text }}</span>
  </div>
</template>
