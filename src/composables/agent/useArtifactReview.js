import { computed, ref, shallowRef, toValue, watch } from 'vue'
import agentApi from '@/api/agent'
import { errorCode, errorMessage, errorStatus } from '@/components/agent/common/agentText'

/**
 * The review of one draft (p2_contract.md 13): the Review with its events,
 * the project's team (who can be asked) and the actions. The server says
 * what this user may do (`review.can`); every action sends the review's
 * `revision`, and a review someone else changed meanwhile is reloaded with
 * the server's message, never overwritten.
 *
 * `onChange(summary)` receives the artifact's new review summary
 * ({state, effective_state, version, reviewer_name, updated_at}) after
 * every action, so chips and lists can follow.
 */
export function useArtifactReview(websiteSource, artifactSource, { onChange = null } = {}) {
  const review = shallowRef(null)
  const team = ref([])
  const teamState = ref('idle')
  const loading = ref(false)
  const busy = ref('')
  const error = ref('')
  let token = 0

  const ids = computed(() => {
    const wid = toValue(websiteSource)
    const aid = toValue(artifactSource)
    return wid && aid ? { wid: String(wid), aid: String(aid) } : null
  })

  function summary(r) {
    if (!r) return null
    return {
      state: r.state,
      effective_state: r.effective_state,
      version: r.version,
      reviewer_name: r.reviewer?.name || '',
      updated_at: r.decided_at || r.requested_at || null,
    }
  }

  async function reload() {
    const target = ids.value
    if (!target) return null
    const mine = ++token
    loading.value = true
    try {
      const { data } = await agentApi.getReview(target.wid, target.aid)
      if (mine !== token) return null
      review.value = data && typeof data === 'object' ? data : null
      return review.value
    } catch (err) {
      if (mine !== token) return null
      error.value = errorMessage(err, "Couldn't load the review.")
      return null
    } finally {
      if (mine === token) loading.value = false
    }
  }

  async function loadTeam() {
    const target = ids.value
    if (!target) return
    teamState.value = 'loading'
    try {
      const { data } = await agentApi.team(target.wid)
      team.value = Array.isArray(data) ? data.filter((m) => m && m.id) : []
      teamState.value = 'ready'
    } catch {
      // Viewers get 403: they see the review but ask nobody.
      team.value = []
      teamState.value = 'error'
    }
  }

  function changed() {
    if (typeof onChange === 'function') onChange(summary(review.value))
  }

  /**
   * Run an action (request, approve, request_changes, withdraw, reopen).
   * `extra` = {reviewer_id, note}. Resolves true when it went through.
   */
  async function act(action, extra = {}) {
    const target = ids.value
    if (!target || busy.value || !review.value) return false
    busy.value = action
    error.value = ''
    try {
      const body = { action, revision: review.value.revision }
      if (extra.reviewer_id) body.reviewer_id = extra.reviewer_id
      if (extra.note !== undefined && extra.note !== '') body.note = extra.note
      const { data } = await agentApi.reviewAction(target.wid, target.aid, body)
      if (data && typeof data === 'object') review.value = data
      changed()
      return true
    } catch (err) {
      error.value = errorMessage(err, "Couldn't update the review. Try again.")
      const code = errorCode(err)
      // Someone acted first: show what is true now, with their message.
      if (code === 'revision_conflict' || code === 'review_state' || errorStatus(err) === 409) {
        const message = error.value
        await reload()
        error.value = message
        changed()
      }
      return false
    } finally {
      busy.value = ''
    }
  }

  async function comment(body) {
    const target = ids.value
    const text = String(body || '').trim()
    if (!target || busy.value || !text) return false
    busy.value = 'comment'
    error.value = ''
    try {
      const { data } = await agentApi.addReviewComment(target.wid, target.aid, { body: text })
      if (review.value && data && typeof data === 'object') {
        review.value = { ...review.value, events: [...(review.value.events || []), data] }
      } else {
        await reload()
      }
      return true
    } catch (err) {
      error.value = errorMessage(err, "Couldn't add the comment. Try again.")
      return false
    } finally {
      busy.value = ''
    }
  }

  watch(
    () => ids.value && `${ids.value.wid}:${ids.value.aid}`,
    () => {
      token += 1
      review.value = null
      team.value = []
      teamState.value = 'idle'
      error.value = ''
      busy.value = ''
    }
  )

  return { review, team, teamState, loading, busy, error, reload, loadTeam, act, comment }
}
