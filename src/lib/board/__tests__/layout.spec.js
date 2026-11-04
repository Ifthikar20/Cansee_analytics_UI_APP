import { describe, expect, it } from 'vitest'
import {
  addWidget,
  defaultLayout,
  moveWidget,
  normalizeLayout,
  removeWidget,
  resizeWidget,
  sameLayout,
} from '../layout'

const BOARD = [
  { key: 'summary', size: 'full' },
  { key: 'countries', size: 'half' },
  { key: 'traffic', size: 'half' },
]

describe('normalizeLayout', () => {
  it('drops unknown and repeated widgets and clamps a size the widget does not allow to its default', () => {
    expect(
      normalizeLayout([
        { key: 'summary', size: 'third' },
        { key: 'overview', size: 'full' },
        { key: 'traffic', size: 'third' },
        { key: 'traffic', size: 'full' },
        { key: 'by-engine', size: 'full' },
        { key: 'sentiment', size: 'huge' },
        null,
        'countries',
        { size: 'half' },
      ]),
    ).toEqual([
      { key: 'summary', size: 'full' },
      { key: 'traffic', size: 'third' },
      { key: 'by-engine', size: 'third' },
      { key: 'sentiment', size: 'third' },
    ])
  })

  it('keeps only key and size, and reads anything but a list as an empty board', () => {
    expect(normalizeLayout([{ key: 'pages', size: 'full', extra: 1 }])).toEqual([{ key: 'pages', size: 'full' }])
    expect(normalizeLayout(null)).toEqual([])
    expect(normalizeLayout({ widgets: [] })).toEqual([])
    expect(normalizeLayout([])).toEqual([])
  })
})

describe('layout edits', () => {
  it('adds a widget at the end at its default size, once', () => {
    expect(addWidget(BOARD, 'ai-crawlers')).toEqual([...BOARD, { key: 'ai-crawlers', size: 'third' }])
    expect(addWidget(BOARD, 'traffic')).toBe(BOARD)
    expect(addWidget(BOARD, 'overview')).toBe(BOARD)
    expect(addWidget([], 'summary')).toEqual([{ key: 'summary', size: 'full' }])
  })

  it('removes a widget', () => {
    expect(removeWidget(BOARD, 'countries')).toEqual([BOARD[0], BOARD[2]])
    expect(removeWidget(BOARD, 'pages')).toBe(BOARD)
  })

  it('moves a widget one place, and not past the ends', () => {
    expect(moveWidget(BOARD, 'traffic', -1).map((w) => w.key)).toEqual(['summary', 'traffic', 'countries'])
    expect(moveWidget(BOARD, 'summary', 1).map((w) => w.key)).toEqual(['countries', 'summary', 'traffic'])
    expect(moveWidget(BOARD, 'summary', -1)).toBe(BOARD)
    expect(moveWidget(BOARD, 'traffic', 1)).toBe(BOARD)
    expect(moveWidget(BOARD, 'pages', 1)).toBe(BOARD)
    // The original is untouched.
    expect(BOARD.map((w) => w.key)).toEqual(['summary', 'countries', 'traffic'])
  })

  it('resizes within the sizes a widget allows, clamping to the nearest one', () => {
    expect(resizeWidget(BOARD, 'traffic', 'third')[2]).toEqual({ key: 'traffic', size: 'third' })
    expect(resizeWidget(BOARD, 'countries', 'full')[1]).toEqual({ key: 'countries', size: 'full' })
    // Countries allows half and full: one third is clamped to half, its size already.
    expect(resizeWidget(BOARD, 'countries', 'third')).toBe(BOARD)
    const withEngine = [...BOARD, { key: 'by-engine', size: 'third' }]
    expect(resizeWidget(withEngine, 'by-engine', 'full')[3]).toEqual({ key: 'by-engine', size: 'half' })
    expect(resizeWidget(BOARD, 'traffic', 'huge')).toBe(BOARD)
    expect(resizeWidget(BOARD, 'pages', 'full')).toBe(BOARD)
    expect(resizeWidget(BOARD, 'summary', 'full')).toBe(BOARD)
  })

  it('compares layouts by key, size and order', () => {
    expect(sameLayout(BOARD, BOARD.map((w) => ({ ...w })))).toBe(true)
    expect(sameLayout(BOARD, moveWidget(BOARD, 'traffic', -1))).toBe(false)
    expect(sameLayout(BOARD, resizeWidget(BOARD, 'traffic', 'full'))).toBe(false)
    expect(sameLayout(BOARD, BOARD.slice(0, 2))).toBe(false)
    expect(sameLayout([], [])).toBe(true)
    expect(sameLayout(null, [])).toBe(false)
  })

  it('copies the default layout', () => {
    const a = defaultLayout()
    a[0].size = 'half'
    expect(defaultLayout()[0]).toEqual({ key: 'summary', size: 'full' })
  })
})
