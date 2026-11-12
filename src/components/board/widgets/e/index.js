// Group E blocks: the account and project blocks (prompt runs, next steps,
// the latest report), each key's compact card and the view its panel
// shows. Every component is a lazy chunk. None has a detail page of its
// own, so each panel is the card at full size.
//
// A block may add `preview: () => import('./XPreview.vue')` to draw its own
// catalog tile; without one the tile draws the catalog's `preview` kind
// (BlockPreview.vue).
const promptRunsCard = () => import('./PromptRunsCard.vue')
const nextStepsCard = () => import('./NextStepsCard.vue')
const latestReportCard = () => import('./LatestReportCard.vue')

const FULL = Object.freeze({ size: 'full' })

export default {
    'prompt-runs': { card: promptRunsCard, panel: promptRunsCard, panelProps: FULL },
    'next-steps': { card: nextStepsCard, panel: nextStepsCard, panelProps: FULL },
    'latest-report': { card: latestReportCard, panel: latestReportCard, panelProps: FULL },
}
