// The research agents: research_swarm, a tool of the Gap Analyst with five
// task types (a Google results page, one AI engine asked one prompt, a page
// read, a content gap, the cited sources). They have no entry in GET
// agents/, so the Agents page shows them as one card whose tasks open a Gap
// Analyst chat (entryAgent). How many run at once is the server's ceiling,
// GET status/ swarm.max_agents.
import { markRaw } from 'vue'
import { Radar } from '@lucide/vue'
import { RESEARCH_AGENTS_TEAMS, teamLabel } from './teams'

export const RESEARCH_AGENTS = Object.freeze({
    key: 'research_agents',
    name: 'Research Agents',
    entryAgent: 'gap_analyst',
    outputKind: 'report',
    // Raw so reactive state holding this does not wrap the component.
    icon: markRaw(Radar),
    description:
        "A team of agents that work in parallel: each one fetches a Google results page, asks one AI engine one prompt or reads one page, yours or a competitor's. Their results merge into one table, and the Gap Analyst writes its report from it.",
    teams: Object.freeze(RESEARCH_AGENTS_TEAMS.map((key) => Object.freeze({ key, label: teamLabel(key) }))),
})
