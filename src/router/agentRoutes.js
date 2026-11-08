// Agent workspace routes, rendered in AppShell's agent area. The new-chat and
// chat URLs share one component reference, so moving from
// /projects/:id/agent to /projects/:id/agent/c/:chatId after the first
// turn reuses the page instance (streams live in the store either way).
import { resolveAgentEntry, resolveChatLink } from './agentGuards'

const AppShell = () => import('@/layouts/AppShell.vue')
const AgentChatPage = () => import('@/pages/agent/AgentChatPage.vue')
const AgentProjectsPage = () => import('@/pages/agent/AgentProjectsPage.vue')
const AgentContextPage = () => import('@/pages/agent/AgentContextPage.vue')
const AgentAgentsPage = () => import('@/pages/agent/AgentAgentsPage.vue')
const AgentArtifactsPage = () => import('@/pages/agent/AgentArtifactsPage.vue')
const AgentArtifactPage = () => import('@/pages/agent/AgentArtifactPage.vue')
const AgentFindingsPage = () => import('@/pages/agent/AgentFindingsPage.vue')
const AgentReviewsPage = () => import('@/pages/agent/AgentReviewsPage.vue')

const meta = { requiresAuth: true, section: 'agent' }
// Tab titles for pages that do not set their own (AppShell applies them);
// the chat and artifact pages title themselves.
const titled = (title) => ({ title })

// Stable arrays: the props function runs on every navigation.
const REPORT_KINDS = Object.freeze(['report'])
const DOCUMENT_KINDS = Object.freeze(['document', 'page'])
const SHEET_KINDS = Object.freeze(['sheet'])
const withKinds = (kinds) => (route) => ({ ...route.params, kinds })

export const agentRoutes = [
    // Redirect-only entries: their guards always return a location.
    { path: '/agent', name: 'agent', component: AppShell, meta, beforeEnter: resolveAgentEntry },
    { path: '/agent/c/:chatId', name: 'agent-chat-link', component: AppShell, meta, beforeEnter: resolveChatLink },
    {
        path: '/agent/projects',
        component: AppShell,
        meta,
        children: [{ path: '', name: 'agent-projects', component: AgentProjectsPage, meta: titled('Projects') }],
    },
    {
        // The :websiteId guard in index.js makes this the active website.
        path: '/projects/:websiteId/agent',
        component: AppShell,
        meta,
        children: [
            { path: '', name: 'agent-home', component: AgentChatPage, props: true },
            { path: 'c/:chatId', name: 'agent-chat', component: AgentChatPage, props: true },
            { path: 'context', name: 'agent-context', component: AgentContextPage, props: true, meta: titled('Context') },
            { path: 'agents', name: 'agent-agents', component: AgentAgentsPage, props: true, meta: titled('Agents') },
            {
                path: 'findings',
                name: 'agent-findings',
                component: AgentFindingsPage,
                props: true,
                meta: titled('Findings'),
            },
            { path: 'reviews', name: 'agent-reviews', component: AgentReviewsPage, props: true, meta: titled('Reviews') },
            {
                path: 'reports',
                name: 'agent-reports',
                component: AgentArtifactsPage,
                props: withKinds(REPORT_KINDS),
                meta: titled('Reports'),
            },
            {
                path: 'documents',
                name: 'agent-documents',
                component: AgentArtifactsPage,
                props: withKinds(DOCUMENT_KINDS),
                meta: titled('Documents'),
            },
            {
                path: 'sheets',
                name: 'agent-sheets',
                component: AgentArtifactsPage,
                props: withKinds(SHEET_KINDS),
                meta: titled('Sheets'),
            },
            { path: 'artifacts/:artifactId', name: 'agent-artifact', component: AgentArtifactPage, props: true },
        ],
    },
]
