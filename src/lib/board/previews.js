// The drawings on the catalog's tiles: one small picture per preview kind,
// as plain shapes in a 160 by 100 box (BlockPreview.vue draws them as SVG).
// They are sketches of a block's layout, not anyone's numbers: the catalog
// marks every tile "Sample data". Each drawing uses the accent once.
// Pure: no Vue, no requests.
//
// A shape is one of
//   {t: 'rect', x, y, w, h, c}        a filled bar or block
//   {t: 'line', points, c}            a polyline, stroked
//   {t: 'path', d, c}                 an outline, stroked
//   {t: 'dot', x, y, r, c}            a filled circle
//   {t: 'text', x, y, size, text, c, mono?}
// and `c` is its paint: 'ink', 'bar' (gray graphic), 'mute' (gray text),
// 'rule' (hairline) or 'you' (the accent).

const rect = (x, y, w, h, c = 'bar') => ({ t: 'rect', x, y, w, h, c })
const line = (points, c = 'ink') => ({ t: 'line', points, c })
const path = (d, c = 'ink') => ({ t: 'path', d, c })
const dot = (x, y, r, c = 'you') => ({ t: 'dot', x, y, r, c })
const text = (x, y, size, value, c = 'ink', mono = false) => ({ t: 'text', x, y, size, text: value, c, mono })

const rows = (count, top, step, make) => Array.from({ length: count }, (_, i) => make(i, top + i * step)).flat()

const DRAWINGS = {
    // The eye: an almond, the iris ring and the accent iris with its glint.
    eye: [
        path('M18 50 Q80 4 142 50 Q80 96 18 50 Z'),
        path('M80 28 a22 22 0 1 0 0.01 0 Z'),
        dot(80, 50, 10),
        dot(76, 46, 2, 'ink'),
    ],
    // A question in large type, then the answer as text bars with "you" in it.
    question: [
        rect(12, 14, 104, 7, 'ink'),
        rect(12, 26, 66, 7, 'ink'),
        rect(12, 52, 124, 5),
        rect(12, 63, 32, 5),
        rect(46, 63, 30, 5, 'you'),
        rect(78, 63, 40, 5),
        rect(12, 74, 112, 5),
        rect(12, 85, 60, 5),
    ],
    // Numbered rows with bars; your row is the accent square and an ink bar.
    rank: rows(5, 14, 16, (i, y) => [
        rect(12, y + 1, 8, 4, 'mute'),
        ...(i === 3 ? [rect(28, y + 1, 4, 4, 'you')] : []),
        rect(44, y, [104, 88, 70, 52, 36][i], 6, i === 3 ? 'ink' : 'bar'),
    ]),
    // One very large number over a thin line that ends in the accent dot.
    numeral: [
        text(10, 52, 50, '74'),
        text(76, 52, 8, '/ 100', 'mute', true),
        line('12,88 28,86 44,89 60,82 76,84 92,76 108,78 124,70 146,66'),
        dot(146, 66, 3),
    ],
    // A question field with its button, then one line per engine.
    ask: [
        path('M12 14 H148 V40 H12 Z', 'rule'),
        rect(20, 25, 62, 4, 'mute'),
        rect(120, 20, 22, 14, 'ink'),
        rect(12, 56, 98, 5),
        rect(12, 68, 26, 5),
        rect(40, 68, 28, 5, 'you'),
        rect(70, 68, 34, 5),
        rect(12, 80, 86, 5),
    ],
    // A list of horizontal bars; yours is ink, with the accent square.
    bars: rows(5, 14, 16, (i, y) => [
        ...(i === 1 ? [rect(12, y + 2, 4, 4, 'you')] : []),
        rect(22, y, [126, 104, 84, 60, 38][i], 8, i === 1 ? 'ink' : 'bar'),
    ]),
    // Four figures in a row, then two lines of text.
    tiles: [
        ...rows(4, 12, 36, (i, x) => [rect(x, 20, 18, 3, 'mute'), rect(x, 30, 26, 13, 'ink')]),
        dot(13.5, 13.5, 1.5),
        rect(12, 58, 136, 1, 'rule'),
        rect(12, 70, 120, 4),
        rect(12, 81, 84, 4),
    ],
    // A table: a header, hairlines, and one cell that is yours.
    table: [
        rect(12, 10, 30, 3, 'mute'),
        rect(88, 10, 16, 3, 'mute'),
        rect(124, 10, 16, 3, 'mute'),
        ...rows(4, 24, 18, (i, y) => [
            rect(12, y - 6, 136, 1, 'rule'),
            rect(12, y, [58, 46, 64, 40][i], 5, 'ink'),
            rect(88, y, 20, 5, i === 1 ? 'you' : 'bar'),
            rect(124, y, 20, 5),
        ]),
    ],
    // A grid of cells, darker where there is more; one is yours.
    grid: rows(4, 12, 20, (r, y) =>
        Array.from({ length: 6 }, (_, c) => {
            const at = r * 6 + c
            const paint = at === 9 ? 'you' : [0, 7, 14, 16, 21].includes(at) ? 'ink' : at % 3 === 0 ? 'mute' : 'bar'
            return rect(12 + c * 23, y, 21, 16, paint)
        })
    ),
    // Two lines over a baseline; yours ends in the accent dot.
    line: [
        rect(12, 88, 136, 1, 'rule'),
        line('12,70 34,66 56,72 78,60 100,64 122,54 146,58', 'bar'),
        line('12,80 34,72 56,62 78,66 100,46 122,40 146,24'),
        dot(146, 24, 3),
    ],
    // A share: a figure, then one bar cut into shares, yours first.
    share: [
        text(10, 40, 30, '28'),
        text(52, 40, 8, '%', 'mute', true),
        rect(12, 58, 38, 14, 'you'),
        rect(52, 58, 46, 14),
        rect(100, 58, 30, 14),
        rect(132, 58, 16, 14),
        rect(12, 84, 40, 3, 'mute'),
    ],
    // Three bars of very different length: most, some, and the few to act on.
    split: [
        rect(12, 16, 26, 3, 'mute'),
        rect(12, 24, 110, 9, 'ink'),
        rect(12, 43, 26, 3, 'mute'),
        rect(12, 51, 44, 9),
        rect(12, 70, 26, 3, 'mute'),
        rect(12, 78, 16, 9, 'you'),
    ],
    // A checklist: square marks and lines, one mark asking for attention.
    checks: rows(4, 16, 19, (i, y) => [
        rect(12, y, 7, 7, i === 2 ? 'you' : 'ink'),
        rect(28, y + 1, [98, 76, 106, 62][i], 5),
    ]),
    // Columns over a baseline; the latest is the accent.
    columns: [
        ...rows(10, 12, 14, (i, x) => {
            const h = [18, 26, 22, 34, 28, 42, 38, 50, 46, 62][i]
            return [rect(x, 86 - h, 9, h, i === 9 ? 'you' : 'bar')]
        }),
        rect(12, 88, 136, 1, 'rule'),
    ],
    // One question fanning out into the searches behind it.
    fan: [
        rect(12, 46, 30, 8, 'ink'),
        ...rows(4, 18, 21, (i, y) => [
            line(`44,50 66,50 78,${y + 3} 86,${y + 3}`, 'mute'),
            rect(90, y, [52, 40, 58, 34][i], 6, i === 1 ? 'you' : 'bar'),
        ]),
    ],
    // A list of new questions: a line of text and a smaller line under it.
    lines: rows(4, 14, 20, (i, y) => [
        rect(12, y, [112, 92, 120, 78][i], 5, 'ink'),
        rect(12, y + 9, [44, 56, 38, 50][i], 3, 'mute'),
        ...(i === 0 ? [dot(144, y + 2.5, 2.5)] : []),
    ]),
    // What is left: a figure and a segmented bar, the next run in the accent.
    meter: [
        text(10, 46, 38, '38'),
        text(62, 46, 8, '/ 50', 'mute', true),
        ...rows(10, 12, 13.8, (i, x) => [rect(x, 62, 11.8, 9, i < 2 ? 'bar' : i === 2 ? 'you' : 'ink')]),
        rect(12, 84, 54, 3, 'mute'),
    ],
    // Numbered steps, each a line and a way forward; the first is next.
    steps: rows(3, 20, 26, (i, y) => [
        text(12, y + 6, 8, `0${i + 1}`, i === 0 ? 'you' : 'mute', true),
        rect(34, y, [86, 70, 94][i], 6, 'ink'),
        rect(12, y + 15, 136, 1, 'rule'),
    ]),
    // A report's cover: a small line, a large title, a rule and its date.
    cover: [
        rect(12, 14, 5, 5, 'you'),
        rect(22, 15, 42, 3, 'mute'),
        rect(12, 40, 116, 10, 'ink'),
        rect(12, 56, 82, 10, 'ink'),
        rect(12, 80, 136, 1, 'rule'),
        rect(12, 87, 32, 3, 'mute'),
        rect(118, 87, 30, 3, 'mute'),
    ],
}

export const PREVIEW_KINDS = Object.freeze(Object.keys(DRAWINGS))

export const PREVIEW_BOX = Object.freeze({ width: 160, height: 100 })

/** The shapes of a preview kind, or [] for an unknown kind. */
export function previewShapes(kind) {
    return Object.hasOwn(DRAWINGS, kind) ? DRAWINGS[kind] : []
}
