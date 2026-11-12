// Every block's card and expanded view, by catalog key (board_ownership.md
// 2). Each group's index.js default-exports
// {[key]: {card: () => import(...), panel: () => import(...), panelProps?,
// preview?: () => import(...)}}, so a card's code loads only when the board
// shows it. Group C holds Ask AI and Prompt ranking (autopilot_frontend.md
// 6); D the four blocks that open a new board; E the account and project
// blocks. `preview` is optional: a block's own drawing for its catalog
// tile, in place of the catalog's preview kind.
import widgetsA from './widgets/a/index.js'
import widgetsB from './widgets/b/index.js'
import widgetsC from './widgets/c/index.js'
import widgetsD from './widgets/d/index.js'
import widgetsE from './widgets/e/index.js'

export const WIDGET_COMPONENTS = Object.freeze({ ...widgetsA, ...widgetsB, ...widgetsC, ...widgetsD, ...widgetsE })
