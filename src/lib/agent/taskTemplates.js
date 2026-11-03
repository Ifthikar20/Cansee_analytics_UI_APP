// The tasks the Agents page drafts for a writing agent (p2_contract.md
// 15d). The text goes into a new chat's composer through askAgent; the
// person reviews it and sends it. A line whose values are missing is left
// out, so an optional field never leaves a half sentence behind.

export const CHANNEL_KEYS = Object.freeze(['linkedin', 'x', 'x_thread'])

// Checkbox labels on the task dialog, and the words {channels} reads.
export const CHANNELS = Object.freeze({
    linkedin: { label: 'LinkedIn', phrase: 'LinkedIn posts' },
    x: { label: 'X', phrase: 'X posts' },
    x_thread: { label: 'X thread', phrase: 'an X thread' },
})

export const PR_FORMATS = Object.freeze({
    press_release: 'Press release',
    media_pitch: 'Media pitch',
    correction_request: 'Correction requests',
})

const TEMPLATES = {
    page_optimizer: 'Optimize {url} so AI engines read and cite it.\nTarget prompt: "{prompt}".\nFocus: {notes}',
    comparison_page:
        'Write a comparison page: {brand} compared with {competitor} ({domain}).\nAlso read their page {url}.\nTarget prompt: "{prompt}".\nFocus: {notes}',
    social_posts_artifact: 'Write {channels} that promote "{artifact_title}" (artifact {artifact_id}).\nFocus: {notes}',
    social_posts_topic: 'Write {channels} about: {notes}',
    press_release: 'Write a press release about: {notes}',
    media_pitch: 'Write a media pitch about: {notes}',
    // The fact_publishers text of contract 15c.
    correction_request:
        'Draft correction requests to the publishers whose pages repeat this claim: "{claim}" (Fact check claim {key}).\nOur evidence ({evidence_label}): "{evidence_quote}"',
    llms_txt: 'Draft an llms.txt file for {domain}.\nFocus: {notes}',
    messaging_brief: 'Write a messaging brief for {brand}.\nFocus: {notes}',
}

function present(value) {
    if (value === null || value === undefined) return false
    return String(value).trim() !== ''
}

/**
 * Fill a template: `{name}` takes values[name]; a line with a placeholder
 * whose value is empty, null or undefined is removed.
 */
export function fillTemplate(template, values = {}) {
    return String(template || '')
        .split('\n')
        .filter((line) => {
            const names = [...line.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1])
            return names.every((name) => present(values[name]))
        })
        .map((line) => line.replace(/\{([a-z_]+)\}/g, (_, name) => String(values[name]).trim()))
        .join('\n')
}

/** "LinkedIn posts", "LinkedIn posts and X posts", "LinkedIn posts, X posts and an X thread". */
export function channelsText(channels) {
    const words = CHANNEL_KEYS.filter((key) => (channels || []).includes(key)).map((key) => CHANNELS[key].phrase)
    if (words.length <= 1) return words.join('')
    return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * The drafted task for an agent. `values` (all optional strings unless
 * named): url, prompt, notes, brand, competitor, domain, channels (array),
 * artifact_id, artifact_title, format, claim, key, evidence_label,
 * evidence_quote, starter (the catalog starter, for the four agents
 * without a task form).
 */
export function taskText(agent, values = {}) {
    const v = values || {}
    switch (agent) {
        case 'page_optimizer':
        case 'comparison_page':
        case 'llms_txt':
        case 'messaging_brief':
            return fillTemplate(TEMPLATES[agent], v)
        case 'social_posts': {
            const filled = { ...v, channels: channelsText(v.channels) }
            const template = present(v.artifact_id) ? TEMPLATES.social_posts_artifact : TEMPLATES.social_posts_topic
            return fillTemplate(template, filled)
        }
        case 'pr_writer':
            return fillTemplate(TEMPLATES[v.format] || TEMPLATES.press_release, v)
        default:
            return String(v.starter || '').trim()
    }
}
