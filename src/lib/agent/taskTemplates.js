// The tasks the Agents page drafts for an agent (p2_contract.md 15d). The
// text goes into a new chat's composer through askAgent; the person reviews
// it and sends it. A line whose values are missing is left out, so an
// optional field never leaves a half sentence behind.
//
// The six specialists have their own inputs (taskText). The four general
// agents and the research agents start from a task template instead
// (TASK_FORMS, formTaskText): each template names the fields it shows and
// which of them it needs. Nothing here costs anything: the agent only runs
// once the person sends the drafted message.

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
 * evidence_quote, starter (the catalog starter, for an agent without a
 * task form).
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

/* ── Task templates of the four general agents and the research agents ── */

// The research agents have no agent key of their own: research_swarm is a
// tool of the Gap Analyst, so their tasks open a Gap Analyst chat.
export const RESEARCH_AGENTS_KEY = 'research_agents'

// The fields a template can show. `kind` picks the input: prompt (free text
// with the tracked prompts to pick from), text, competitors (the tracked
// competitors as checkboxes), url (a page of the project's site), notes (a
// textarea).
export const FORM_FIELDS = Object.freeze({
    prompt: { kind: 'prompt', label: 'Prompt', max: 300 },
    question: { kind: 'prompt', label: 'Question', max: 300 },
    search: { kind: 'prompt', label: 'Search or prompt', max: 300 },
    competitors: { kind: 'competitors', label: 'Competitors' },
    offering: { kind: 'text', label: 'Offering', max: 200 },
    cta: { kind: 'text', label: 'Call to action', max: 200 },
    audience: { kind: 'text', label: 'Audience', max: 200 },
    region: { kind: 'text', label: 'Region', max: 100 },
    url: { kind: 'url', label: 'Landing page' },
    notes: { kind: 'notes', label: 'Focus', max: 1000 },
})

function form(entryAgent, templates) {
    return Object.freeze({
        entryAgent,
        templates: Object.freeze(templates.map((t) => Object.freeze({ required: [], ...t }))),
    })
}

// `fields` in the order shown; `required` the ones the template cannot do
// without. {max_prompts} is filled from GET status/ (how many prompts one
// research covers); without it that line is left out.
export const TASK_FORMS = Object.freeze({
    [RESEARCH_AGENTS_KEY]: form('gap_analyst', [
        {
            key: 'gap',
            label: 'Google vs AI gap',
            summary: 'Where Google ranks you compared with what each AI engine answers, on your tracked prompts.',
            fields: ['notes'],
            text: 'Run the research agents on our tracked prompts and compare where Google ranks us with how each AI engine answers.\nUse up to {max_prompts} of our tracked prompts.\nFocus: {notes}',
        },
        {
            key: 'competitors',
            label: 'Competitor check',
            summary: 'Read your competitors\' pages next to yours and list what theirs do that yours do not.',
            fields: ['competitors', 'notes'],
            required: ['competitors'],
            text: 'Run the research agents to compare us with {competitors} on our tracked prompts.\nRead 2 competitor pages per prompt and list what their pages do that ours do not.\nUse up to {max_prompts} of our tracked prompts.\nFocus: {notes}',
        },
        {
            key: 'sources',
            label: 'Sources audit',
            summary: 'The sources the AI engines cite for your tracked prompts, and which of them name you.',
            fields: ['notes'],
            text: 'Run the research agents on our tracked prompts to find the sources the AI engines cite.\nList which sources mention us, which mention only our competitors, and where we should be listed.\nUse up to {max_prompts} of our tracked prompts.\nFocus: {notes}',
        },
        {
            key: 'prompt',
            label: 'Check one prompt',
            summary: 'Google and every AI engine for one prompt you pick or type.',
            fields: ['prompt', 'notes'],
            required: ['prompt'],
            text: 'Run the research agents on one prompt: "{prompt}".\nCompare where Google ranks us with how each AI engine answers it.\nFocus: {notes}',
        },
    ]),
    gap_analyst: form('gap_analyst', [
        {
            key: 'tracked',
            label: 'Tracked prompts',
            summary: 'Google and AI answers compared across the prompts you track.',
            fields: ['notes'],
            text: 'Research how we rank on Google and in AI answers for our tracked prompts, and compare the two.\nFocus: {notes}',
        },
        {
            key: 'prompt',
            label: 'One prompt',
            summary: 'The same comparison for one prompt.',
            fields: ['prompt', 'notes'],
            required: ['prompt'],
            text: 'Research how we rank on Google and in AI answers for this prompt: "{prompt}", and compare the two.\nFocus: {notes}',
        },
        {
            key: 'competitors',
            label: 'Against competitors',
            summary: 'Where Google and the AI engines put your competitors above you.',
            fields: ['competitors', 'notes'],
            required: ['competitors'],
            text: 'Compare how Google and the AI engines rank us against {competitors} for our tracked prompts.\nFocus: {notes}',
        },
    ]),
    landing_page: form('landing_page', [
        {
            key: 'search',
            label: 'For one search',
            summary: 'A page for one search or prompt your buyers use.',
            fields: ['search', 'offering', 'cta', 'notes'],
            required: ['search'],
            text: 'Draft a landing page for the search "{search}".\nOffering: {offering}\nCall to action: {cta}\nFocus: {notes}',
        },
        {
            key: 'missing',
            label: 'Where we are missing most',
            summary: 'The agent picks the tracked prompt where you are missing the most.',
            fields: ['offering', 'cta', 'notes'],
            text: 'Draft a landing page for the tracked prompt where we are missing the most.\nOffering: {offering}\nCall to action: {cta}\nFocus: {notes}',
        },
        {
            key: 'offering',
            label: 'For one offering',
            summary: 'A page that sells one thing you offer.',
            fields: ['offering', 'cta', 'notes'],
            required: ['offering'],
            text: 'Draft a landing page for our offering: {offering}.\nCall to action: {cta}\nFocus: {notes}',
        },
    ]),
    aeo_article: form('aeo_article', [
        {
            key: 'question',
            label: 'Answer one question',
            summary: 'An answer-first article for one question buyers ask.',
            fields: ['question', 'audience', 'notes'],
            required: ['question'],
            text: 'Write an answer-first article for the question "{question}".\nAudience: {audience}\nFocus: {notes}',
        },
        {
            key: 'top',
            label: 'Top buyer question',
            summary: 'The agent picks the question your buyers ask most, from your tracked prompts.',
            fields: ['audience', 'notes'],
            text: 'Write an article that answers the question our buyers ask most, from our tracked prompts.\nAudience: {audience}\nFocus: {notes}',
        },
        {
            key: 'uncited',
            label: 'Where AI cites others',
            summary: 'The tracked prompt where AI engines cite other sites but not yours.',
            fields: ['audience', 'notes'],
            text: 'Write an article for the tracked prompt where AI engines cite other sites but not ours.\nAudience: {audience}\nFocus: {notes}',
        },
    ]),
    ad_campaign: form('ad_campaign', [
        {
            key: 'offering',
            label: 'One offering',
            summary: 'A Google Search campaign for one thing you sell.',
            fields: ['offering', 'region', 'url', 'notes'],
            required: ['offering'],
            text: 'Build a Google Search ad campaign for {offering}.\nRegion: {region}\nLanding page: {url}\nFocus: {notes}',
        },
        {
            key: 'main',
            label: 'Our main offering',
            summary: 'The agent picks your main offering from your context.',
            fields: ['region', 'url', 'notes'],
            text: 'Build a Google Search ad campaign for our main offering.\nRegion: {region}\nLanding page: {url}\nFocus: {notes}',
        },
        {
            key: 'gaps',
            label: 'Prompts where we are missing',
            summary: 'Ads for the tracked prompts where Google and the AI engines do not show you.',
            fields: ['region', 'url', 'notes'],
            text: 'Build a Google Search ad campaign for the tracked prompts where Google and the AI engines do not show us.\nRegion: {region}\nLanding page: {url}\nFocus: {notes}',
        },
    ]),
})

/** Whether `agent` starts from a task template. */
export function hasTaskForm(agent) {
    return Object.prototype.hasOwnProperty.call(TASK_FORMS, agent)
}

/** The templates of `agent` ([] for none). */
export function formTemplates(agent) {
    return hasTaskForm(agent) ? TASK_FORMS[agent].templates : []
}

/** The template `key` of `agent`, its first template for an unknown key, or null. */
export function formTemplate(agent, key = null) {
    const list = formTemplates(agent)
    return list.find((t) => t.key === key) || list[0] || null
}

/** The agent key a chat opens with for `agent` (the research agents run under the Gap Analyst). */
export function entryAgentOf(agent) {
    return hasTaskForm(agent) ? TASK_FORMS[agent].entryAgent : agent
}

/** The label of a field in a template: "Offering", or "Offering (optional)". */
export function fieldLabel(template, field) {
    const base = FORM_FIELDS[field]?.label || field
    return template && template.required.includes(field) ? base : `${base} (optional)`
}

/** "Evernote (evernote.com)", "Evernote (evernote.com) and Coda (coda.io)". */
export function competitorsText(list) {
    const words = (Array.isArray(list) ? list : [])
        .filter((c) => c && (c.name || c.domain))
        .map((c) => {
            const name = String(c.name || c.domain).trim()
            const domain = String(c.domain || '').trim()
            return domain && domain !== name ? `${name} (${domain})` : name
        })
    if (words.length <= 1) return words.join('')
    return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The required fields of the template that are still empty, in field order. */
export function missingFields(agent, templateKey, values = {}) {
    const template = formTemplate(agent, templateKey)
    if (!template) return []
    const v = values || {}
    return template.fields.filter((field) => {
        if (!template.required.includes(field)) return false
        if (field === 'competitors') return !(Array.isArray(v.competitors) && v.competitors.length)
        return !present(v[field])
    })
}

/**
 * The drafted task of a template. `values`: the template's fields (strings;
 * competitors is [{name, domain}]) plus max_prompts. Fields the template
 * does not show are ignored, so a value typed under another template never
 * leaks in. '' for an agent without templates.
 */
export function formTaskText(agent, templateKey, values = {}) {
    const template = formTemplate(agent, templateKey)
    if (!template) return ''
    const v = values || {}
    const filled = { max_prompts: v.max_prompts }
    for (const field of template.fields) {
        const limit = FORM_FIELDS[field]?.max
        if (field === 'competitors') filled.competitors = competitorsText(v.competitors)
        else if (present(v[field])) filled[field] = limit ? String(v[field]).trim().slice(0, limit) : String(v[field]).trim()
    }
    return fillTemplate(template.text, filled)
}
