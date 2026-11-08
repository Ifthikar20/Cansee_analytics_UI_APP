// Group B widgets (board_frontend.md 11b): each key's compact card and the
// view its panel shows. Every component is a lazy chunk; the panels are the
// existing pages, given a `focus` where one page serves several widgets.
// FE-board merges this map with group A's into WIDGET_COMPONENTS.
const visibilityPage = () => import('@/pages/analytics/VisibilityPage.vue')

export default {
    visibility: {
        card: () => import('./VisibilityCard.vue'),
        panel: visibilityPage,
        panelProps: { focus: 'over-time' },
    },
    'by-engine': {
        card: () => import('./ByEngineCard.vue'),
        panel: visibilityPage,
        panelProps: { focus: 'by-engine' },
    },
    'who-recommends': {
        card: () => import('./WhoRecommendsCard.vue'),
        panel: () => import('./LeaderboardPanel.vue'),
    },
    'share-of-voice': {
        card: () => import('./ShareOfVoiceCard.vue'),
        panel: visibilityPage,
        panelProps: { focus: 'share-of-voice' },
    },
    sentiment: {
        card: () => import('./SentimentCard.vue'),
        panel: () => import('@/pages/analytics/SentimentPage.vue'),
    },
    'fact-check': {
        card: () => import('./FactCheckCard.vue'),
        panel: () => import('@/pages/analytics/FactCheckPage.vue'),
    },
    citations: {
        card: () => import('./CitationsCard.vue'),
        panel: () => import('./CitationsPanel.vue'),
    },
    'crawler-access': {
        card: () => import('./CrawlerAccessCard.vue'),
        panel: () => import('@/pages/analytics/CrawlerAccessPage.vue'),
    },
    pages: {
        card: () => import('./PagesCard.vue'),
        panel: () => import('@/pages/analytics/SitePagesPage.vue'),
    },
    'fan-outs': {
        card: () => import('./FanoutsCard.vue'),
        panel: () => import('@/pages/analytics/FanoutsPage.vue'),
    },
    'prompt-research': {
        card: () => import('./PromptResearchCard.vue'),
        panel: () => import('@/pages/analytics/PromptResearchPage.vue'),
    },
    competitors: {
        card: () => import('./CompetitorsCard.vue'),
        panel: () => import('@/pages/analytics/CompetitorsPage.vue'),
    },
    products: {
        card: () => import('./ProductsCard.vue'),
        panel: () => import('@/pages/analytics/ProductsPage.vue'),
    },
}
