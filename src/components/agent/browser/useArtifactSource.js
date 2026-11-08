import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import { backoffDelay } from '@/lib/agent/backoff'
import { useAgentStore } from '@/stores/agent'

// What an artifact tab shows: the streaming draft while a sub-agent writes,
// otherwise the saved latest version or an older version picked in the
// version menu. Everything is loaded through the agent store, which keeps
// versions in artifacts[id].byVersion and the list in artifacts[id].versions.
//
// options.call(id) is what the bound chat knows about the agent call that
// writes the artifact ({status, active, saved, error, kind, title}, see
// agentPane.artifactCall). The agent names an artifact when it starts and
// creates it only when a draft is saved, so this tells a draft that was never
// saved from an item that was deleted.

// A finished draft shows, unchecked, until its saved copy loads, so that load
// is retried this many times while it fails for a passing reason.
const SAVED_RETRIES = 4
const SAVED_RETRY_BASE_MS = 1000

function num(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function statusOf(err) {
  return err?.status ?? err?.response?.status ?? 0
}

function transient(err) {
  const status = statusOf(err)
  return !status || status >= 500 || status === 408 || status === 429
}

export function parseSheet(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// The draft's status, unless its agent call has ended while the draft still
// says drafting: the run stopped without the draft's own end event, so
// nothing writes it anymore. It then counts as failed, or as 'stale' when
// the call finished and the saved copy is the one to show.
export function draftStatusOf(draft, call) {
  const status = draft?.status || ''
  if (status !== 'drafting' || !call || !call.status || call.active) return status
  return call.status === 'done' ? 'stale' : 'failed'
}

function lookup(agent, id) {
  try {
    if (typeof agent.artifact === 'function') return agent.artifact(id) || null
  } catch {}
  return (agent.artifacts && agent.artifacts[id]) || null
}

// {title, body, retry}; retry is false when trying again cannot help.
export function describeLoadError(err, call = null) {
  const status = statusOf(err)
  if (status === 404 && call && !call.saved) {
    return { title: "This draft wasn't saved.", body: call.error || 'The agent stopped before it was finished.', retry: false }
  }
  if (status === 404) {
    return { title: 'This item is no longer available.', body: 'It was deleted, or you no longer have access to it.', retry: true }
  }
  if (!status) return { title: "This item couldn't be loaded.", body: 'Check your connection and try again.', retry: true }
  return { title: "This item couldn't be loaded.", body: err?.message || err?.displayMessage || '', retry: true }
}

export function useArtifactSource(idSource, versionSource = null, { call: callOf = null } = {}) {
  const agent = useAgentStore()

  const id = computed(() => {
    const value = toValue(idSource)
    return value === undefined || value === null || value === '' ? null : String(value)
  })
  const requested = computed(() => num(toValue(versionSource)))

  const state = ref('idle')
  const error = ref(null)
  const versionState = ref('idle')
  const versionError = ref(null)

  const artifact = computed(() => (id.value === null ? null : lookup(agent, id.value)))
  const call = computed(() => (id.value !== null && typeof callOf === 'function' ? callOf(id.value) || null : null))
  const draft = computed(() => artifact.value?.draft || null)
  const draftStatus = computed(() => draftStatusOf(draft.value, call.value))
  const drafting = computed(() => draftStatus.value === 'drafting')
  const failure = computed(() => {
    if (draftStatus.value !== 'failed') return null
    if (draft.value.status === 'failed') return draft.value.error || { code: 'failed', message: '' }
    return { code: call.value.status, message: call.value.error || '' }
  })
  const savedVersion = computed(() => num(artifact.value?.version))
  const hasSaved = computed(() => artifact.value?.content !== undefined && artifact.value?.content !== null)
  const latestVersion = computed(
    () => Math.max(num(artifact.value?.latest_version) ?? 0, savedVersion.value ?? 0, num(draft.value?.version) ?? 0) || null
  )

  // A finished draft whose saved copy has not loaded yet.
  const behind = computed(() => {
    const d = draft.value
    if (d?.status !== 'done') return false
    const v = num(d.version)
    return !hasSaved.value || (v !== null && (savedVersion.value ?? 0) < v)
  })

  // The draft shows while it streams, and after it finishes until the saved
  // copy catches up with it. A draft picked up mid-stream (`partial`) holds
  // only the text since then, so it never shows.
  const showDraft = computed(() => {
    const d = draft.value
    if (!d || d.partial) return false
    return drafting.value || behind.value
  })

  const selected = computed(() => {
    const v = requested.value
    if (v === null || showDraft.value) return null
    if (v === latestVersion.value || v === savedVersion.value) return null
    return v
  })

  const versionPayload = computed(() => {
    if (selected.value === null) return null
    const byVersion = artifact.value?.byVersion
    return (byVersion && byVersion[String(selected.value)]) || null
  })

  const kind = computed(() => artifact.value?.kind || draft.value?.kind || call.value?.kind || '')
  const title = computed(
    () => (showDraft.value && draft.value?.title) || artifact.value?.title || draft.value?.title || call.value?.title || ''
  )

  const content = computed(() => {
    if (selected.value !== null) return versionPayload.value ? versionPayload.value.content ?? '' : null
    if (showDraft.value) return draft.value.content ?? ''
    return hasSaved.value ? artifact.value.content : null
  })

  const data = computed(() => {
    if (selected.value !== null) return versionPayload.value?.data ?? null
    if (showDraft.value) return draft.value.data ?? null
    return artifact.value?.data ?? null
  })

  const sheet = computed(() => {
    if (kind.value !== 'sheet') return null
    if (selected.value === null && showDraft.value) return parseSheet(draft.value.data ?? draft.value.content)
    return parseSheet(content.value)
  })

  const warnings = computed(() => {
    const source = selected.value !== null ? versionPayload.value : showDraft.value ? draft.value : artifact.value
    return Array.isArray(source?.warnings) ? source.warnings : []
  })

  const shownVersion = computed(() => {
    if (selected.value !== null) return selected.value
    if (showDraft.value) return num(draft.value.version)
    return savedVersion.value
  })

  const versions = computed(() => {
    const list = artifact.value?.versions
    return Array.isArray(list) ? list.slice().sort((a, b) => (num(b.version) ?? 0) - (num(a.version) ?? 0)) : null
  })

  const ready = computed(() => (kind.value === 'sheet' ? sheet.value !== null : content.value !== null))

  let retryTimer = null
  let retries = 0

  function cancelRetry() {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
  }

  async function fetchSaved() {
    cancelRetry()
    const target = id.value
    if (target === null || typeof agent.loadArtifact !== 'function') return
    state.value = 'loading'
    error.value = null
    try {
      await agent.loadArtifact(target)
      if (id.value !== target) return
      state.value = 'ready'
      retries = 0
    } catch (err) {
      if (id.value !== target) return
      const known = call.value
      if (statusOf(err) === 404 && known && known.active && !known.saved) {
        // Named but not saved yet: the draft is still starting.
        state.value = 'waiting'
        return
      }
      error.value = describeLoadError(err, known)
      if (behind.value && transient(err) && retries < SAVED_RETRIES) {
        // Stays loading until the next try.
        retryTimer = setTimeout(fetchSaved, backoffDelay(retries, { base: SAVED_RETRY_BASE_MS }))
        retries += 1
        return
      }
      state.value = 'error'
    }
  }

  // Loads the saved copy (again), with a fresh set of retries.
  function load() {
    retries = 0
    return fetchSaved()
  }

  async function loadVersions() {
    const target = id.value
    if (target === null || typeof agent.loadVersions !== 'function') return
    try {
      await agent.loadVersions(target)
    } catch {}
  }

  async function loadSelectedVersion() {
    const target = id.value
    const v = selected.value
    if (target === null || v === null || versionPayload.value) return
    versionState.value = 'loading'
    versionError.value = null
    try {
      await agent.loadArtifact(target, v)
      if (id.value === target && selected.value === v) versionState.value = 'ready'
    } catch (err) {
      if (id.value !== target || selected.value !== v) return
      versionState.value = 'error'
      versionError.value = describeLoadError(err)
    }
  }

  watch(
    id,
    () => {
      cancelRetry()
      retries = 0
      state.value = 'idle'
      error.value = null
    },
    { flush: 'sync' }
  )

  // Load the saved copy when it is missing, or behind a finished draft, and
  // again when the agent call that writes it moves on.
  watch(
    [id, hasSaved, draftStatus, behind, () => call.value?.status ?? ''],
    ([target, saved, status, isBehind]) => {
      if (target === null) return
      if (saved && !isBehind) {
        // It arrived some other way (the store refreshes it on completion).
        if (retryTimer) {
          cancelRetry()
          state.value = 'ready'
        }
        return
      }
      if (state.value === 'loading' || status === 'drafting') return
      if (state.value === 'error' && !isBehind) return
      load()
    },
    { immediate: true }
  )

  watch(
    () => [id.value, selected.value],
    () => {
      versionState.value = versionPayload.value ? 'ready' : 'idle'
      versionError.value = null
      if (selected.value !== null) loadSelectedVersion()
    },
    { immediate: true }
  )

  onScopeDispose(cancelRetry)

  return {
    id,
    artifact,
    draft,
    kind,
    title,
    content,
    data,
    sheet,
    warnings,
    drafting,
    failure,
    showDraft,
    selected,
    shownVersion,
    latestVersion,
    versions,
    ready,
    state,
    error,
    versionState,
    versionError,
    load,
    loadVersions,
    loadSelectedVersion,
  }
}
