import { describe, expect, it } from 'vitest'
import { neighbors, TILE_COLUMNS, TILE_ROWS, TILES, tileOf } from '@/lib/charts/tileGrid'

// apps/llm_ranking/services/regions.supported_countries() codes (73).
const REGIONS_CATALOG = `US CA IN GB DE AU FR ES IT NL SE IE RU UA PL BR MX AR CL CO PE JP KR CN TW SG HK AE SA
  QA KW BH OM JO LB EG MA ZA NG KE GH ID PH MY TH VN PK BD LK NP TR IL NZ CH AT BE PT NO DK FI GR CZ RO HU
  BG HR SK RS IS LU EE LV LT`
  .trim()
  .split(/\s+/)

describe('tile grid', () => {
  it('has 114 unique countries', () => {
    expect(TILES).toHaveLength(114)
    expect(new Set(TILES.map((t) => t.code)).size).toBe(114)
  })

  it('puts every tile on its own cell inside 23 x 14', () => {
    expect(TILE_COLUMNS).toBe(23)
    expect(TILE_ROWS).toBe(14)
    expect(new Set(TILES.map((t) => `${t.x},${t.y}`)).size).toBe(114)
    for (const t of TILES) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x).toBeLessThan(TILE_COLUMNS)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeLessThan(TILE_ROWS)
    }
  })

  it('covers every country of the backend catalog', () => {
    expect(REGIONS_CATALOG).toHaveLength(73)
    expect(REGIONS_CATALOG.filter((code) => !tileOf(code))).toEqual([])
  })

  it('finds tiles in any case, UK as GB', () => {
    expect(tileOf('uk')).toBe(tileOf('GB'))
    expect(tileOf('gb')).toMatchObject({ code: 'GB', x: 9, y: 1 })
    expect(tileOf('li')).toBe(null)
    expect(tileOf('')).toBe(null)
  })

  it('moves to the nearest tile in each direction', () => {
    expect(neighbors.GB).toEqual({ left: 'IE', right: 'DK', up: 'NO', down: 'NL' })
    expect(neighbors.US.down).toBe('MX')
    expect(neighbors.NZ.right).toBe(null)
  })

  it('reaches every tile from every tile with arrow keys', () => {
    for (const start of TILES) {
      const seen = new Set([start.code])
      const queue = [start.code]
      while (queue.length) {
        const code = queue.shift()
        for (const next of Object.values(neighbors[code])) {
          if (next && !seen.has(next)) {
            seen.add(next)
            queue.push(next)
          }
        }
      }
      expect(seen.size).toBe(114)
    }
  })
})
