import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import VizTileMap from '@/components/charts/VizTileMap.vue'
import { binsFor } from '@/lib/charts/scales'
import { normalizeVizSpec } from '@/lib/charts/spec'
import { TILES } from '@/lib/charts/tileGrid'

enableAutoUnmount(afterEach)

const spec = normalizeVizSpec({
  title: 'Visitors by country',
  x: 'country',
  value: 'percent',
  labels: ['gb', 'de', 'us', 'li', 'xk', 'fr'],
  label_names: { gb: 'United Kingdom', li: 'Liechtenstein' },
  state_labels: { not_found: 'Not in top 10' },
  datasets: [
    {
      key: 'ai',
      label: 'AI visibility',
      data: [85, 10, null, 30, null, null],
      states: [null, null, 'not_checked', null, 'not_checked', 'not_found'],
    },
  ],
})

function render(props = {}) {
  return mount(VizTileMap, {
    props: { spec, dataset: spec.datasets[0], bins: binsFor(spec, spec.datasets[0]), title: spec.title, ...props },
    attachTo: document.body,
  })
}

const tile = (wrapper, code) => wrapper.find(`[data-code="${code}"]`)

describe('VizTileMap', () => {
  it('draws one button per country on the grid', () => {
    const wrapper = render()
    const tiles = wrapper.findAll('button.viz-tile')
    expect(tiles).toHaveLength(TILES.length)
    expect(tiles.map((t) => t.text())).toEqual(TILES.map((t) => t.code))
    expect(tile(wrapper, 'GB').attributes('style')).toContain('grid-column: 10')
    expect(tile(wrapper, 'GB').attributes('style')).toContain('grid-row: 2')
  })

  it('shades measured tiles by bin and labels every tile with its name and value', () => {
    const wrapper = render()
    expect(tile(wrapper, 'GB').classes()).toContain('is-bin')
    expect(tile(wrapper, 'GB').attributes('style')).toContain('var(--viz-seq-5)')
    expect(tile(wrapper, 'GB').attributes('aria-label')).toBe('United Kingdom: 85%')
    expect(tile(wrapper, 'DE').attributes('aria-label')).toBe('Germany: 10%')
    expect(tile(wrapper, 'DE').attributes('style')).toContain('var(--viz-seq-1)')
  })

  it('tells measured-absent from not checked and no data', () => {
    const wrapper = render()
    expect(tile(wrapper, 'FR').classes()).toContain('is-absent')
    expect(tile(wrapper, 'FR').attributes('aria-label')).toBe('France: Not in top 10')
    expect(tile(wrapper, 'US').classes()).toContain('is-nodata')
    expect(tile(wrapper, 'US').attributes('aria-label')).toBe('United States: Not checked')
    expect(tile(wrapper, 'JP').classes()).toContain('is-nodata')
    expect(tile(wrapper, 'JP').attributes('aria-label')).toBe('Japan: No data')
  })

  it('lists measured countries that are not on the grid', () => {
    const wrapper = render()
    expect(wrapper.find('.viz-map-also').text()).toBe('Also measured: Liechtenstein 30%')
  })

  it('keeps one tab stop and moves with the arrow keys', async () => {
    const wrapper = render()
    const tabbable = wrapper.findAll('button.viz-tile').filter((b) => b.attributes('tabindex') === '0')
    expect(tabbable.map((b) => b.attributes('data-code'))).toEqual(['GB'])

    tile(wrapper, 'GB').element.focus()
    await tile(wrapper, 'GB').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tile(wrapper, 'DK').element)
    await nextTick()
    expect(tile(wrapper, 'DK').attributes('tabindex')).toBe('0')
    expect(tile(wrapper, 'GB').attributes('tabindex')).toBe('-1')

    await tile(wrapper, 'DK').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(tile(wrapper, 'DE').element)
    await tile(wrapper, 'DE').trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(tile(wrapper, 'NL').element)
  })

  it('shows a tooltip on focus that stays with its tile when the grid scrolls', async () => {
    const wrapper = render()
    await tile(wrapper, 'DE').trigger('focus')
    expect(wrapper.find('.viz-tip').text()).toBe('Germany · 10%')
    // Focusing a tile off screen scrolls the grid; the tooltip must survive it.
    await wrapper.find('.viz-map-scroll').trigger('scroll')
    expect(wrapper.find('.viz-tip').text()).toBe('Germany · 10%')
    await tile(wrapper, 'DE').trigger('blur')
    expect(wrapper.find('.viz-tip').exists()).toBe(false)
    await wrapper.find('.viz-map-scroll').trigger('scroll')
    expect(wrapper.find('.viz-tip').exists()).toBe(false)
  })

  it('emits select when someone listens, and rings the selected tile', async () => {
    const wrapper = render({ selectable: true, selected: 'uk' })
    expect(tile(wrapper, 'GB').classes()).toContain('is-selected')
    await tile(wrapper, 'DE').trigger('click')
    expect(wrapper.emitted('select')).toEqual([
      [{ label: 'DE', labelIndex: 1, datasetKey: 'ai', value: 10, state: null }],
    ])
  })

  it('does not emit select when no one listens', async () => {
    const wrapper = render()
    await tile(wrapper, 'DE').trigger('click')
    expect(wrapper.emitted('select')).toBe(undefined)
  })
})
