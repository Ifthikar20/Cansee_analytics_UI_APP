// Teams the Agents page groups the agents by (p2_contract.md 12a, 12b).
// GET agents/ sends each agent's teams; AGENT_TEAMS is the same table, used
// before the catalog loads and for a server that does not send them yet.

export const TEAMS = Object.freeze([
    { key: 'aeo_seo', label: 'AEO and SEO' },
    { key: 'content', label: 'Content' },
    { key: 'social', label: 'Social' },
    { key: 'growth', label: 'Growth' },
    { key: 'pr', label: 'PR and comms' },
    { key: 'product_marketing', label: 'Product marketing' },
    { key: 'brand', label: 'Brand' },
])

export const TEAM_KEYS = Object.freeze(TEAMS.map((t) => t.key))

// First team = the agent's primary team.
export const AGENT_TEAMS = Object.freeze({
    gap_analyst: ['aeo_seo', 'growth'],
    page_optimizer: ['aeo_seo', 'content'],
    aeo_article: ['content', 'aeo_seo'],
    llms_txt: ['aeo_seo'],
    comparison_page: ['product_marketing', 'content', 'growth'],
    landing_page: ['growth', 'product_marketing'],
    ad_campaign: ['growth'],
    social_posts: ['social', 'content'],
    pr_writer: ['pr', 'brand'],
    messaging_brief: ['product_marketing', 'brand'],
})

/** The label of a team key, '' for an unknown one. */
export function teamLabel(key) {
    return TEAMS.find((t) => t.key === key)?.label || ''
}

/**
 * An agent's teams as [{key, label}], primary first: the catalog entry's
 * `teams` when it sends any, else AGENT_TEAMS. Unknown keys are left out.
 */
export function agentTeams(agentKey, catalogTeams = null) {
    const fromCatalog = Array.isArray(catalogTeams)
        ? catalogTeams
              .map((t) => (typeof t === 'string' ? { key: t } : t))
              .filter((t) => t && TEAM_KEYS.includes(t.key))
        : []
    if (fromCatalog.length) return fromCatalog.map((t) => ({ key: t.key, label: t.label || teamLabel(t.key) }))
    return (AGENT_TEAMS[agentKey] || []).map((key) => ({ key, label: teamLabel(key) }))
}
