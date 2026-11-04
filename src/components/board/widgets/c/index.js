// Group C widgets (autopilot_frontend.md 6b): Ask AI and Prompt ranking,
// each key's compact card and the view its panel shows. Every component is
// a lazy chunk. Ask AI's panel shows the run in the panel key `run`;
// Prompt ranking's panel keeps its order in `order`.
export default {
    'prompt-box': {
        card: () => import('./PromptBoxCard.vue'),
        panel: () => import('./PromptBoxPanel.vue'),
    },
    ranking: {
        card: () => import('./RankingCard.vue'),
        panel: () => import('./RankingPanel.vue'),
    },
}
