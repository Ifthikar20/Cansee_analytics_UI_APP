// Group D blocks: the four that open a new board (the watch, the latest
// question, who AI names, the visibility score), each key's compact card
// and the view its panel shows. Every component is a lazy chunk. The watch
// has no detail of its own, so its panel is the card at full size; the
// other three open the existing view of the same data.
//
// A block may add `preview: () => import('./XPreview.vue')` to draw its own
// catalog tile; without one the tile draws the catalog's `preview` kind
// (BlockPreview.vue). The watch's tile is the card's own eye, and the
// visibility score's shows the block's real unit, a percent.
const watchCard = () => import('./WatchCard.vue')

export default {
    watch: {
        card: watchCard,
        panel: watchCard,
        panelProps: { size: 'full' },
        preview: () => import('./WatchPreview.vue'),
    },
    'asked-answered': {
        card: () => import('./AskedAnsweredCard.vue'),
        panel: () => import('../a/PromptsPanel.vue'),
    },
    'answer-rank': {
        card: () => import('./AnswerRankCard.vue'),
        panel: () => import('../b/LeaderboardPanel.vue'),
    },
    'visibility-score': {
        card: () => import('./VisibilityScoreCard.vue'),
        panel: () => import('@/pages/analytics/VisibilityPage.vue'),
        panelProps: { focus: 'over-time' },
        preview: () => import('./VisibilityScorePreview.vue'),
    },
}
