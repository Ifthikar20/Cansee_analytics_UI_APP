import { computed, ref, toValue, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'

// What an artifact tab shows: the streaming draft while a sub-agent writes,
// otherwise the saved latest version or an older version picked in the
// version menu. Everything is loaded through the agent store, which keeps
// versions in artifacts[id].byVersion and the list in artifacts[id].versions.

function num(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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

function lookup(agent, id) {
  try {
    if (typeof agent.artifact === 'function') return agent.artifact(id) || null
  } catch {}
  return (agent.artifacts && agent.artifacts[id]) || null
}

export function describeLoadError(err) {
  const status = err?.status ?? err?.response?.status ?? 0
  if (status === 404) return { title: 'This item is no longer available.', body: 'It was deleted, or you no longer have access to it.' }
  if (!status) return { title: "This item couldn't be loaded.", body: 'Check your connection and try again.' }
  return { title: "This item couldn't be loaded.", body: err?.message || err?.displayMessage || '' }
}

export function useArtifactSource(idSource, versionSource = null) {
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
  const draft = computed(() => artifact.value?.draft || null)
  const drafting = computed(() => draft.value?.status === 'drafting')
  const failure = computed(() =>
    draft.value?.status === 'failed' ? draft.value.error || { code: 'failed', message: '' } : null
  )
  const savedVersion = computed(() => num(artifact.value?.version))
  const hasSaved = computed(() => artifact.value?.content !== undefined && artifact.value?.content !== null)
  const latestVersion = computed(
    () => Math.max(num(artifact.value?.latest_version) ?? 0, savedVersion.value ?? 0, num(draft.value?.version) ?? 0) || null
  )

  // The draft shows while it streams, and after it finishes until the saved
  // copy catches up with it.
  const showDraft = computed(() => {
    const d = draft.value
    if (!d) return false
    if (d.status === 'drafting') return true
    if (d.status === 'done') {
      const v = num(d.version)
      return !hasSaved.value || (v !== null && (savedVersion.value ?? 0) < v)
    }
    return false
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

  const kind = computed(() => artifact.value?.kind || draft.value?.kind || '')
  const title = computed(
    () => (showDraft.value && draft.value?.title) || artifact.value?.title || draft.value?.title || ''
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

  async function load() {
    const target = id.value
    if (target === null || typeof agent.loadArtifact !== 'function') return
    state.value = 'loading'
    error.value = null
    try {
      await agent.loadArtifact(target)
      if (id.value === target) state.value = 'ready'
    } catch (err) {
      if (id.value !== target) return
      state.value = 'error'
      error.value = describeLoadError(err)
    }
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
      state.value = 'idle'
      error.value = null
    },
    { flush: 'sync' }
  )

  // Load the saved copy when it is missing, or behind a finished draft.
  watch(
    () => [id.value, hasSaved.value, draft.value?.status, savedVersion.value, num(draft.value?.version)],
    ([target, saved, draftStatus, savedV, draftV]) => {
      if (target === null || state.value === 'loading' || draftStatus === 'drafting') return
      const behind = draftStatus === 'done' && draftV !== null && (savedV ?? 0) < draftV
      if (saved && !behind) return
      if (state.value === 'error' && !behind) return
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
