// Arrow keys on the world map: from one country, the nearest other
// country in that direction, on the map's own coordinates (y grows
// downward, as in the SVG). Candidates inside the 45-degree cone come
// first, else anywhere in that half of the map; distance across the
// direction costs twice distance along it, so a key keeps to its row or
// column when it can.

const DIRECTIONS = Object.freeze({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] })

function nearest(from, marks, [ux, uy]) {
  for (const coneOnly of [true, false]) {
    let best = null
    let bestScore = Infinity
    for (const mark of marks) {
      if (mark === from) continue
      const dx = mark.cx - from.cx
      const dy = mark.cy - from.cy
      const along = dx * ux + dy * uy
      const across = Math.abs(dx * uy - dy * ux)
      if (along <= 0 || (coneOnly && across > along)) continue
      const score = along + 2 * across
      if (score < bestScore) {
        bestScore = score
        best = mark
      }
    }
    if (best) return best.code
  }
  return null
}

/**
 * [{code, cx, cy}] -> {code: {left, right, up, down}}, each a code or null.
 * Marks without a code or a finite position are left out; the first mark
 * of a repeated code wins.
 */
export function neighborMap(marks) {
  const seen = new Set()
  const list = []
  for (const mark of Array.isArray(marks) ? marks : []) {
    if (!mark?.code || seen.has(mark.code) || !Number.isFinite(mark.cx) || !Number.isFinite(mark.cy)) continue
    seen.add(mark.code)
    list.push(mark)
  }
  return Object.fromEntries(
    list.map((mark) => [
      mark.code,
      Object.fromEntries(Object.entries(DIRECTIONS).map(([name, dir]) => [name, nearest(mark, list, dir)])),
    ]),
  )
}
