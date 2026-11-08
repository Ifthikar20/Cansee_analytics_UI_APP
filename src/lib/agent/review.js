// Review states, actions and copy for drafts (p2_contract.md 13). A review
// lives beside its artifact; the server decides who may do what (`can`)
// and this file only words it.
import { markRaw } from 'vue'
import {
    CircleCheck as CircleCheckIcon,
    CircleDashed as CircleDashedIcon,
    Clock as ClockIcon,
    MessageSquareWarning as MessageSquareWarningIcon,
} from '@lucide/vue'
import { relativeTime } from '@/components/agent/common/agentText'

export const REVIEW_STATES = Object.freeze({
    draft: { key: 'draft', word: 'Draft', icon: markRaw(CircleDashedIcon) },
    in_review: { key: 'in_review', word: 'In review', icon: markRaw(ClockIcon) },
    changes_requested: { key: 'changes_requested', word: 'Changes requested', icon: markRaw(MessageSquareWarningIcon) },
    approved: { key: 'approved', word: 'Approved', icon: markRaw(CircleCheckIcon) },
})

export const REVIEW_STATE_KEYS = Object.freeze(Object.keys(REVIEW_STATES))

// The Review filter of the artifact lists ('' = All).
export const REVIEW_FILTERS = Object.freeze([
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'in_review', label: 'In review' },
    { value: 'changes_requested', label: 'Changes requested' },
    { value: 'approved', label: 'Approved' },
])

export const REVIEW_BOXES = Object.freeze([
    { key: 'waiting', label: 'Waiting for you', empty: 'Nothing is waiting for your review.' },
    { key: 'mine', label: 'Your requests', empty: "You haven't asked for any reviews." },
    { key: 'approved', label: 'Approved', empty: 'Nothing was approved in the last 90 days.' },
])

export const SOLE_WRITER_LINE = "You're the only member of this project, so you can approve it yourself."
export const NO_TEAMMATE_LINE = 'Add a teammate to this project to ask for a review.'
export const PANEL_FOOTER = "Approving doesn't publish anything. Export the draft to use it."

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }

export function roleLabel(role) {
    return ROLE_LABELS[role] || String(role || '')
}

const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

/** The effective state of a review summary or Review ('draft' when never reviewed). */
export function effectiveState(review) {
    const state = review?.effective_state || review?.state
    return REVIEW_STATES[state] ? state : 'draft'
}

export function stateMeta(state) {
    return REVIEW_STATES[state] || REVIEW_STATES.draft
}

/** The chip's text: the state word, `Approved v{n}` for an approval of the latest version. */
export function chipText(review) {
    const state = effectiveState(review)
    const v = num(review?.version)
    if (state === 'approved' && v) return `Approved v${v}`
    return stateMeta(state).word
}

/** The read-only export line: `Approved: version {v}` or `Not approved yet`. */
export function approvalLine(review) {
    const v = num(review?.version)
    if (effectiveState(review) === 'approved' && v) return `Approved: version ${v}`
    return 'Not approved yet'
}

function name(person, fallback = 'Someone') {
    const n = typeof person === 'string' ? person : person?.name
    return typeof n === 'string' && n.trim() ? n.trim() : fallback
}

/** The panel's status line for a Review (contract 13a, frontend 14). */
export function statusLine(review, now = Date.now()) {
    if (!review) return 'Not reviewed yet.'
    const state = review.state
    const effective = effectiveState(review)
    const v = num(review.version)
    const latest = num(review.latest_version)
    if (state === 'approved' && effective === 'draft') {
        return `Version ${v} was approved. Version ${latest} hasn't been reviewed.`
    }
    if (effective === 'in_review') {
        const when = relativeTime(review.requested_at, now)
        const line = `${name(review.requested_by)} asked ${name(review.reviewer)} to review version ${v}${when ? ` ${when}` : ''}.`
        return review.updated_since_request && latest ? `${line} It changed to version ${latest} since then.` : line
    }
    if (effective === 'changes_requested') {
        const when = relativeTime(review.decided_at, now)
        return `${name(review.decided_by || review.reviewer)} asked for changes${when ? ` ${when}` : ''}.`
    }
    if (effective === 'approved') {
        const when = relativeTime(review.decided_at, now)
        return `${name(review.decided_by)} approved version ${v}${when ? ` ${when}` : ''}.`
    }
    return 'Not reviewed yet.'
}

/** One timeline line for a ReviewEvent ('' for a comment: its text shows under the name). */
export function eventLine(event) {
    const actor = name(event?.actor_name)
    const v = num(event?.version)
    switch (event?.kind) {
        case 'requested':
            return `${actor} asked ${name(event.reviewer_name, 'a teammate')} to review version ${v}.`
        case 'approved':
            return `${actor} approved version ${v}.`
        case 'changes_requested':
            return `${actor} asked for changes to version ${v}.`
        case 'withdrawn':
            return `${actor} withdrew the review request.`
        case 'reopened':
            return `${actor} reopened it for editing.`
        default:
            return ''
    }
}

/** The email suffix of an event, '' when it sent none (or email is off). */
export function emailLine(event) {
    if (event?.email === 'sent') return 'Email sent.'
    if (event?.email === 'failed') return "The email couldn't be sent."
    return ''
}

/** The toast after an action succeeds. */
export function actionToast(action, { reviewerName = '' } = {}) {
    switch (action) {
        case 'request':
            return `Review requested from ${name(reviewerName, 'your teammate')}.`
        case 'approve':
            return 'Approved.'
        case 'request_changes':
            return 'Changes requested.'
        case 'withdraw':
            return 'Request withdrawn.'
        case 'reopen':
            return 'Reopened.'
        case 'comment':
            return 'Comment added.'
        default:
            return ''
    }
}

/**
 * The row line of the Reviews page: `Asked by {name}` in Waiting for you,
 * else `Reviewer: {name}`; '' when the summary does not name that person
 * (the contract's review summary carries `reviewer_name` only, so the
 * requester shows when the server adds `requested_by_name`).
 */
export function reviewPersonLine(box, summary) {
    if (box === 'waiting') {
        const asker = summary?.review?.requested_by_name
        return asker ? `Asked by ${asker}` : ''
    }
    const reviewer = summary?.review?.reviewer_name
    return reviewer ? `Reviewer: ${reviewer}` : ''
}
