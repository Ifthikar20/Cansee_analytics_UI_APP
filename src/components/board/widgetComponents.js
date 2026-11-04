// Every widget's card and expanded view, by catalog key (board_ownership.md
// 2). Each group's index.js default-exports
// {[key]: {card: () => import(...), panel: () => import(...), panelProps?}},
// so a card's code loads only when the board shows it.
import widgetsA from './widgets/a/index.js'
import widgetsB from './widgets/b/index.js'

export const WIDGET_COMPONENTS = Object.freeze({ ...widgetsA, ...widgetsB })
