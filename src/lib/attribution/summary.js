// The "Where you stand" strip (attribution_contract.md 1, summary): the
// attribution summary as short facts. Pure.

function nameList(names, max = 3) {
    const list = (Array.isArray(names) ? names : []).filter((n) => typeof n === 'string' && n.trim())
    if (list.length <= max) return list.join(', ')
    return `${list.slice(0, max).join(', ')} and ${list.length - max} more`
}

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0)

/**
 * [{key, label, value, tone}] for the strip, or [] without a summary.
 * tone is good | warn | bad | neutral and only colors the value.
 */
export function summaryFacts(summary) {
    if (!summary || typeof summary !== 'object') return []
    const facts = []
    const rank = Number.isInteger(summary.rank) && summary.rank > 0 ? summary.rank : null
    const ahead = nameList(summary.brands_ahead)
    if (summary.mentioned) {
        facts.push({
            key: 'named',
            label: summary.brand ? `${summary.brand} in this answer` : 'Your brand',
            value: rank ? `Named, #${rank}` : 'Named',
            tone: rank === 1 ? 'good' : 'neutral',
        })
        facts.push({
            key: 'ahead',
            label: 'Named before you',
            value: ahead || 'No one',
            tone: ahead ? 'warn' : 'good',
        })
    } else {
        facts.push({
            key: 'named',
            label: summary.brand ? `${summary.brand} in this answer` : 'Your brand',
            value: 'Not named',
            tone: 'bad',
        })
        if (ahead) facts.push({ key: 'ahead', label: 'Named instead', value: ahead, tone: 'warn' })
    }
    const total = count(summary.sources_total)
    const yours = count(summary.sources_yours)
    facts.push({
        key: 'sources',
        label: 'Sources',
        value: total ? `${total} ${total === 1 ? 'source' : 'sources'}, ${yours} yours` : 'None found',
        tone: total && !yours ? 'warn' : 'neutral',
    })
    facts.push({
        key: 'evidence',
        label: 'Evidence',
        value: `${count(summary.confirmed)} confirmed, ${count(summary.likely)} likely`,
        tone: 'neutral',
    })
    return facts
}
