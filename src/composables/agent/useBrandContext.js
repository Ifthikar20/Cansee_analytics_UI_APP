import { computed, ref, shallowRef, toValue, watch } from 'vue'
import agentApi from '@/api/agent'
import { errorCode, errorMessage, errorStatus } from '@/components/agent/common/agentText'

/**
 * A project's context (p2_contract.md 11): GET context/ and every write of
 * the Context page. Each call names the page's own project, so a form shown
 * for one project is never written to another, and an answer that arrives
 * after the page moved on is dropped.
 *
 * Writes resolve with the server's object and then refresh the overview
 * (its counts and suggestions change with every write). A stale revision
 * marks that entry in `conflicts` and rejects, so its form can offer a
 * reload; other failures reject with {code, status, message}.
 */

export class ContextError extends Error {
  constructor({ code = '', status = 0, message = '', details = null } = {}) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function toError(err, fallback) {
  if (err instanceof ContextError) return err
  return new ContextError({
    code: errorCode(err) || '',
    status: errorStatus(err) || 0,
    message: errorMessage(err, fallback),
    details: err?.response?.data?.error?.details ?? null,
  })
}

const list = (value) => (Array.isArray(value) ? value : [])

export function useBrandContext(websiteSource) {
  const overview = shallowRef(null)
  const loading = ref(false)
  const error = ref('')
  // entry id -> true when a save met a newer revision
  const conflicts = ref({})
  let token = 0

  const websiteId = computed(() => {
    const value = toValue(websiteSource)
    return value === undefined || value === null || value === '' ? null : String(value)
  })

  const entries = computed(() => list(overview.value?.entries))
  const documents = computed(() => list(overview.value?.documents))
  const canEdit = computed(() => overview.value?.can_edit === true)

  async function reload({ quiet = false } = {}) {
    const wid = websiteId.value
    if (!wid) return null
    const mine = ++token
    if (!quiet) {
      loading.value = true
      error.value = ''
    }
    try {
      const { data } = await agentApi.getContext(wid, { _silentError: true })
      if (mine !== token || websiteId.value !== wid) return null
      overview.value = data && typeof data === 'object' ? data : null
      error.value = ''
      return overview.value
    } catch (err) {
      if (mine !== token || websiteId.value !== wid) return null
      // A quiet refresh after a write keeps what is on screen.
      if (!quiet || !overview.value) error.value = errorMessage(err, "Couldn't load the context.")
      return null
    } finally {
      if (mine === token) loading.value = false
    }
  }

  // Runs one write for the page's project; refreshes the overview after it
  // unless the caller batches several writes and refreshes once.
  async function write(fn, fallback, { refresh = true } = {}) {
    const wid = websiteId.value
    if (!wid) throw new ContextError({ code: 'no_project', message: 'Choose a project first.' })
    try {
      const res = await fn(wid)
      if (refresh && websiteId.value === wid) await reload({ quiet: true })
      return res?.data ?? null
    } catch (err) {
      throw toError(err, fallback)
    }
  }

  function markConflict(id, on) {
    const next = { ...conflicts.value }
    if (on) next[id] = true
    else delete next[id]
    conflicts.value = next
  }

  function createEntry({ section, title = '', body = '', references = [] }) {
    return write(
      (wid) => agentApi.createContextEntry(wid, { section, title, body, references }),
      "Couldn't save the entry. Try again."
    )
  }

  async function updateEntry(entry, fields) {
    try {
      const saved = await write(
        (wid) => agentApi.updateContextEntry(wid, entry.id, { revision: entry.revision, ...fields }),
        "Couldn't save the entry. Try again."
      )
      markConflict(entry.id, false)
      return saved
    } catch (err) {
      if (err.code === 'revision_conflict' || err.status === 409) markConflict(entry.id, true)
      throw err
    }
  }

  /**
   * Save an entry form: a new entry with its sources in one request, or an
   * existing one's changed fields, then the sources added and removed in the
   * form. `entry` is the entry as the form opened it (its revision guards
   * the save); `fields` = {section, title, body}; `add` = [RefInput];
   * `remove` = [Reference]. One refresh at the end, also after a partial
   * failure, except after a conflict: the form keeps the person's edits
   * until they choose to reload.
   */
  async function saveEntry(entry, fields, { add = [], remove = [] } = {}) {
    if (!entry) return createEntry({ ...fields, references: add })
    const changed = {}
    for (const key of ['section', 'title', 'body']) {
      if (fields[key] !== undefined && fields[key] !== entry[key]) changed[key] = fields[key]
    }
    let conflict = false
    try {
      let saved = entry
      if (Object.keys(changed).length) {
        try {
          saved = await write(
            (wid) => agentApi.updateContextEntry(wid, entry.id, { revision: entry.revision, ...changed }),
            "Couldn't save the entry. Try again.",
            { refresh: false }
          )
          markConflict(entry.id, false)
        } catch (err) {
          conflict = err.code === 'revision_conflict' || err.status === 409
          if (conflict) markConflict(entry.id, true)
          throw err
        }
      }
      for (const input of add) {
        await write((wid) => agentApi.addContextReference(wid, entry.id, input), "Couldn't add the source. Try again.", {
          refresh: false,
        })
      }
      for (const reference of remove) {
        await write(
          (wid) => agentApi.deleteContextReference(wid, reference.id),
          "Couldn't remove the source. Try again.",
          { refresh: false }
        )
      }
      return saved
    } finally {
      if (!conflict) await reload({ quiet: true })
    }
  }

  function deleteEntry(entry) {
    return write(
      (wid) => agentApi.deleteContextEntry(wid, entry.id, entry.revision),
      "Couldn't delete the entry. Try again."
    )
  }

  function review({ accept = [], dismiss = [] } = {}) {
    return write(
      (wid) => agentApi.reviewContextEntries(wid, { accept, dismiss }),
      "Couldn't update the suggestions. Try again."
    )
  }

  function addReference(entry, input) {
    return write((wid) => agentApi.addContextReference(wid, entry.id, input), "Couldn't add the source. Try again.")
  }

  function deleteReference(reference) {
    return write((wid) => agentApi.deleteContextReference(wid, reference.id), "Couldn't remove the source. Try again.")
  }

  /** A document with its `text` (for editing); not cached. */
  async function loadDocument(id) {
    const wid = websiteId.value
    if (!wid) throw new ContextError({ code: 'no_project', message: 'Choose a project first.' })
    try {
      const { data } = await agentApi.getContextDocument(wid, id)
      return data
    } catch (err) {
      throw toError(err, "Couldn't load the document.")
    }
  }

  function createDocument({ title, text }) {
    return write((wid) => agentApi.createContextDocument(wid, { title, text }), "Couldn't save the document. Try again.")
  }

  function updateDocument(id, fields) {
    return write((wid) => agentApi.updateContextDocument(wid, id, fields), "Couldn't save the document. Try again.")
  }

  function deleteDocument(id) {
    return write((wid) => agentApi.deleteContextDocument(wid, id), "Couldn't delete the document. Try again.")
  }

  /** Reload after a conflict: the newer version replaces the form. */
  async function resolveConflict(id) {
    await reload()
    markConflict(id, false)
  }

  // Another project: drop this one's context before the new one loads.
  watch(websiteId, () => {
    token += 1
    overview.value = null
    error.value = ''
    conflicts.value = {}
    loading.value = false
  })

  return {
    websiteId,
    overview,
    entries,
    documents,
    canEdit,
    loading,
    error,
    conflicts,
    reload,
    createEntry,
    updateEntry,
    saveEntry,
    deleteEntry,
    review,
    addReference,
    deleteReference,
    loadDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    resolveConflict,
  }
}
