import { h } from 'vue'

// Renders one captured string, with marks from lib/agent/highlight. Every
// piece is a text node (or a text node inside <mark>), so page text never
// becomes markup. Without segments it renders the string as is.
// Functional on purpose: the reader view renders one per block, list item
// and table cell, and a stateless render keeps that cheap.

// Read before brand and competitor marks, since colour alone does not tell
// them apart for everyone.
const LABELS = { brand: 'Brand: ', competitor: 'Competitor: ' }

export default function HighlightedText(props) {
  const segments = props.segments
  if (!Array.isArray(segments)) return props.text == null ? '' : String(props.text)
  return segments.map((seg) => {
    if (!seg.kind) return seg.text
    const current = seg.index !== undefined && seg.index === props.current
    const label = LABELS[seg.kind]
    return h(
      'mark',
      {
        class: ['ag-hl', `is-${seg.kind}`, { 'is-current': current }],
        'data-hl-index': seg.index,
        'aria-current': current ? 'true' : undefined,
      },
      label ? [h('span', { class: 'ag-sr-only' }, label), seg.text] : [seg.text]
    )
  })
}

HighlightedText.props = {
  text: { type: [String, Number], default: '' },
  segments: { type: Array, default: null },
  current: { type: Number, default: -1 },
}
