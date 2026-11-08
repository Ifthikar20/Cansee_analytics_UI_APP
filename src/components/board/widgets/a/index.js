// Group A widgets (board_frontend.md 11a): the four default widgets and
// the traffic family, each key's compact card and the view its panel
// shows. Every component is a lazy chunk; the traffic panels are the
// existing pages, given a `focus` where one page serves two widgets.
// FE-board merges this map with group B's into WIDGET_COMPONENTS.
const aiTrafficPage = () => import('@/pages/analytics/AiTrafficPage.vue')

export default {
    summary: {
        card: () => import('./SummaryCard.vue'),
        panel: () => import('./SummaryPanel.vue'),
    },
    prompts: {
        card: () => import('./PromptsCard.vue'),
        panel: () => import('./PromptsPanel.vue'),
    },
    countries: {
        card: () => import('./CountriesCard.vue'),
        panel: () => import('@/pages/analytics/CountriesPage.vue'),
    },
    traffic: {
        card: () => import('./TrafficCard.vue'),
        panel: () => import('@/pages/analytics/TrafficPage.vue'),
    },
    'ai-traffic': {
        card: () => import('./AiTrafficCard.vue'),
        panel: aiTrafficPage,
        panelProps: { focus: 'visits' },
    },
    'ai-crawlers': {
        card: () => import('./AiCrawlersCard.vue'),
        panel: aiTrafficPage,
        panelProps: { focus: 'crawlers' },
    },
}
