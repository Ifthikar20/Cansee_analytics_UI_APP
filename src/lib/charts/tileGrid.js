// The country map: a dependency-free tile grid, one square per country,
// laid out roughly where the country sits (23 columns x 14 rows). It
// covers every country of the backend catalog
// (apps/llm_ranking/services/regions.supported_countries) and every
// ScraperAPI country except Liechtenstein; a measured country that is not
// on the grid is listed under the map instead. A geographic choropleth
// would need about 165 KB of map data and projection code; tiles read
// values as well, take arrow keys and theme through tokens.

export const TILE_COLUMNS = 23
export const TILE_ROWS = 14

// One line per row: "CODE column".
const LAYOUT = [
  'IS 7, NO 10, SE 11, FI 12',
  'CA 0, IE 8, GB 9, DK 10, EE 12, RU 14',
  'US 0, NL 9, DE 10, PL 11, LV 12, BY 13',
  'MX 0, CU 2, DO 3, PR 4, BE 8, LU 9, CZ 10, SK 11, LT 12, UA 13, KZ 15, MN 19',
  'GT 0, CR 1, PA 2, FR 8, CH 9, AT 10, HU 11, RO 12, MD 13, UZ 16, KR 20, JP 21',
  'CO 2, VE 3, PT 7, ES 8, IT 9, SI 10, HR 11, RS 12, BG 13, GE 15, CN 19',
  'EC 1, PE 2, BR 3, MT 9, BA 11, AL 12, MK 13, TR 14, AM 15, AZ 16, HK 20, TW 21',
  'BO 2, PY 3, GR 13, CY 14, LB 15, IQ 16, IR 17, PK 18, NP 19',
  'CL 1, AR 2, UY 3, MA 9, DZ 10, TN 11, LY 12, EG 13, IL 14, JO 15, KW 16, IN 18, BD 19, MM 20',
  'SN 8, CI 9, GH 10, NG 11, CM 12, SD 13, ET 14, SA 15, BH 16, QA 17, LK 18, TH 20, VN 21, PH 22',
  'UG 13, KE 14, AE 17, OM 18, MY 20',
  'AO 11, TZ 13, SG 20, ID 21',
  'ZW 12, MZ 13, AU 21',
  'ZA 12, NZ 22',
]

/** [{ code, x, y }]: x is the column, y the row, both from 0. */
export const TILES = Object.freeze(
  LAYOUT.flatMap((line, y) =>
    line.split(',').map((cell) => {
      const [code, column] = cell.trim().split(/\s+/)
      return Object.freeze({ code, x: Number(column), y })
    }),
  ),
)

const BY_CODE = new Map(TILES.map((tile) => [tile.code, tile]))

/** The tile for an ISO-2 code (any case; "UK" is GB), or null. */
export function tileOf(code) {
  let key = String(code ?? '').trim().toUpperCase()
  if (key === 'UK') key = 'GB'
  return BY_CODE.get(key) || null
}

const DIRECTIONS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }

// The nearest tile in a direction: candidates inside the 45-degree cone
// first, else anywhere in that half of the grid; distance across the
// direction costs twice distance along it, so a key keeps to its row or
// column when it can.
function nearest(from, [ux, uy]) {
  let best = null
  for (const coneOnly of [true, false]) {
    let bestScore = Infinity
    for (const tile of TILES) {
      if (tile === from) continue
      const dx = tile.x - from.x
      const dy = tile.y - from.y
      const along = dx * ux + dy * uy
      const across = Math.abs(dx * uy - dy * ux)
      if (along <= 0 || (coneOnly && across > along)) continue
      const score = along + 2 * across
      if (score < bestScore) {
        bestScore = score
        best = tile
      }
    }
    if (best) return best.code
  }
  return null
}

/** For arrow keys: code -> { left, right, up, down } (codes or null). */
export const neighbors = Object.freeze(
  Object.fromEntries(
    TILES.map((tile) => [
      tile.code,
      Object.freeze(Object.fromEntries(Object.entries(DIRECTIONS).map(([name, dir]) => [name, nearest(tile, dir)]))),
    ]),
  ),
)
