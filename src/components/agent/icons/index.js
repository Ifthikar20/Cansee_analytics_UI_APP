import { defineComponent, h } from 'vue'

// Custom 16px glyphs for the agent workspace where the reference does not
// use a lucide icon. Same contract as @lucide/vue: 24-unit grid, stroke in
// currentColor, `size` and `strokeWidth` props, decorative by default.

function createIcon(name, nodes, { filled = false } = {}) {
  return defineComponent({
    name,
    props: {
      size: { type: [Number, String], default: 16 },
      strokeWidth: { type: [Number, String], default: 2 },
    },
    setup(props, { attrs }) {
      return () =>
        h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size,
            height: props.size,
            viewBox: '0 0 24 24',
            fill: filled ? 'currentColor' : 'none',
            stroke: filled ? 'none' : 'currentColor',
            'stroke-width': filled ? undefined : props.strokeWidth,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'aria-hidden': attrs['aria-label'] ? undefined : 'true',
            focusable: 'false',
            class: ['ag-icon', `ag-icon-${name.replace(/^Icon/, '').toLowerCase()}`],
          },
          nodes.map(([tag, nodeAttrs]) => h(tag, nodeAttrs)),
        )
    },
  })
}

const RING = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4 - Math.PI / 2
  return ['circle', { cx: +(12 + 8 * Math.cos(angle)).toFixed(2), cy: +(12 + 8 * Math.sin(angle)).toFixed(2), r: 1.6 }]
})

/** Agent: two outlined chevrons, one nested in the other. */
export const IconAgent = createIcon('IconAgent', [
  ['path', { d: 'M2.5 4H7l6 8-6 8H2.5l6-8z' }],
  ['path', { d: 'M11 4h4.5l6 8-6 8H11l6-8z' }],
])

/** Projects: a bowl under two lid lines. */
export const IconProjects = createIcon('IconProjects', [
  ['path', { d: 'M6.5 4.5h11' }],
  ['path', { d: 'M5 8h14' }],
  ['path', { d: 'M3.5 11.5h17v2a6 6 0 0 1-6 6h-5a6 6 0 0 1-6-6z' }],
])

/** Context: a ring of eight dots around a centre dot. */
export const IconContext = createIcon('IconContext', [...RING, ['circle', { cx: 12, cy: 12, r: 2.2 }]], {
  filled: true,
})

/** Agents: one node branching down to two. */
export const IconAgents = createIcon('IconAgents', [
  ['circle', { cx: 12, cy: 5.5, r: 2.5 }],
  ['circle', { cx: 5.5, cy: 18.5, r: 2.5 }],
  ['circle', { cx: 18.5, cy: 18.5, r: 2.5 }],
  ['path', { d: 'M12 8v3.5' }],
  ['path', { d: 'M5.5 16v-1.5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3V16' }],
])

/** Sheets: a rounded square with an off-centre cross. */
export const IconSheets = createIcon('IconSheets', [
  ['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 3.5 }],
  ['path', { d: 'M3.5 10h17' }],
  ['path', { d: 'M10 3.5v17' }],
])

/** Documents: a rounded page with three lines, no folded corner. */
export const IconDocuments = createIcon('IconDocuments', [
  ['rect', { x: 5, y: 3, width: 14, height: 18, rx: 3 }],
  ['path', { d: 'M9 8h6' }],
  ['path', { d: 'M9 12h6' }],
  ['path', { d: 'M9 16h3' }],
])

/** Reports: the document page with three bars. */
export const IconReports = createIcon('IconReports', [
  ['rect', { x: 5, y: 3, width: 14, height: 18, rx: 3 }],
  ['path', { d: 'M9 17v-3' }],
  ['path', { d: 'M12 17v-7' }],
  ['path', { d: 'M15 17v-5' }],
])

/** Findings: a flag on its pole, the fly cut back to a notch. */
export const IconFindings = createIcon('IconFindings', [
  ['path', { d: 'M5 21V4' }],
  ['path', { d: 'M5 4h11.5l-2.5 4.5 2.5 4.5H5' }],
])

/** Recent chat: two round speech bubbles, the front one covering the back. */
export const IconRecentChat = createIcon('IconRecentChat', [
  ['path', { d: 'M7.5 16H4.5a1 1 0 0 1-1-1V9.75a6.25 6.25 0 0 1 12.08-2.25' }],
  ['path', { d: 'M15.5 20.5a5 5 0 1 1 5-5v4a1 1 0 0 1-1 1z' }],
])

/** Sidebar toggle: a wide frame with a short bar on the left. */
export const IconPanelLeft = createIcon('IconPanelLeft', [
  ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 4 }],
  ['path', { d: 'M7 9v6' }],
])

/** Browser pane toggle: a wide frame with a full-height bar on the right. */
export const IconPanelRight = createIcon('IconPanelRight', [
  ['rect', { x: 2.5, y: 4.5, width: 19, height: 15, rx: 3.5 }],
  ['path', { d: 'M15 4.5v15' }],
])

export const AGENT_ICONS = Object.freeze({
  IconAgent,
  IconProjects,
  IconContext,
  IconAgents,
  IconSheets,
  IconDocuments,
  IconReports,
  IconFindings,
  IconRecentChat,
  IconPanelLeft,
  IconPanelRight,
})
