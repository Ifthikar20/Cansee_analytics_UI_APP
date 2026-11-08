// The world map's geometry, built once per session. topojson-client and the
// atlas (world-atlas countries-110m, about 39 KB gzipped) load on the first
// map through dynamic imports, so neither reaches the entry chunk; d3-geo
// comes with VizGeoMap, the only importer of this file, which VizChart
// itself loads lazily.
//
// The projection is Equal Earth fitted into a 1000 x 440 viewBox. It is
// equal-area, so a country's shade is never inflated by its size. Paths
// are projected once; the SVG scales, so nothing is recomputed on resize.
import { geoEqualEarth, geoPath } from 'd3-geo'
import { BY_NAME, ISO_NUMERIC_TO_A2, POINT_COUNTRIES } from './isoNumeric'

export const WORLD_WIDTH = 1000
export const WORLD_HEIGHT = 440

// Antarctica takes a band of the map and is never measured.
const ANTARCTICA = '010'
// Below this projected area a country is hard to see or point at, so a
// measured one also gets a dot (VizGeoMap).
const TINY_AREA = 12
const PADDING = 2

const round = (n) => Math.round(n * 100) / 100

function codeOf(feature) {
  if (feature.id !== undefined && feature.id !== null && feature.id !== '') {
    return ISO_NUMERIC_TO_A2[String(feature.id)] || null
  }
  return BY_NAME[feature.properties?.name] ?? null
}

// The centroid of the feature's largest polygon, so France sits in Europe
// rather than being pulled toward French Guiana, and the United States on
// its contiguous states.
function anchorOf(path, feature) {
  const geometry = feature.geometry
  if (geometry?.type !== 'MultiPolygon') return path.centroid(feature)
  let best = null
  let bestArea = -1
  for (const coordinates of geometry.coordinates) {
    const part = { type: 'Polygon', coordinates }
    const area = path.area(part)
    if (area > bestArea) {
      bestArea = area
      best = part
    }
  }
  return path.centroid(best || feature)
}

async function build() {
  const [topojson, atlasModule] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-110m.json'),
  ])
  const feature = topojson.feature || topojson.default?.feature
  const atlas = atlasModule.default || atlasModule
  const all = feature(atlas, atlas.objects.countries).features
  const kept = { type: 'FeatureCollection', features: all.filter((f) => String(f.id ?? '') !== ANTARCTICA) }
  const projection = geoEqualEarth().fitExtent(
    [
      [PADDING, PADDING],
      [WORLD_WIDTH - PADDING, WORLD_HEIGHT - PADDING],
    ],
    kept,
  )
  const path = geoPath(projection)

  const shapes = kept.features.map((f) => {
    const name = String(f.properties?.name || '')
    const [cx, cy] = anchorOf(path, f)
    return Object.freeze({
      key: f.id ? String(f.id) : `name:${name}`,
      code: codeOf(f),
      name,
      d: path(f) || '',
      cx: round(cx),
      cy: round(cy),
      tiny: path.area(f) < TINY_AREA,
    })
  })

  const points = Object.entries(POINT_COUNTRIES).map(([code, lonLat]) => {
    const [cx, cy] = projection(lonLat)
    return Object.freeze({ code, cx: round(cx), cy: round(cy) })
  })

  return Object.freeze({ width: WORLD_WIDTH, height: WORLD_HEIGHT, shapes: Object.freeze(shapes), points: Object.freeze(points) })
}

let pending = null

/**
 * The map, memoized for the session:
 * { width, height, shapes: [{key, code, name, d, cx, cy, tiny}], points: [{code, cx, cy}] }.
 * `code` is ISO-2, or null for the two features that are not countries.
 * A failed load is forgotten, so the next map tries again.
 */
export function loadWorld() {
  if (!pending) {
    pending = build().catch((err) => {
      pending = null
      throw err
    })
  }
  return pending
}
