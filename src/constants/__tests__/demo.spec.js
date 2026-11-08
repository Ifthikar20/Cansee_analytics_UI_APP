import { describe, expect, it, vi } from 'vitest'
import {
  DEMO_SALES_EMAIL,
  demoMailtoHref,
  normalizeBookingUrl,
  openDemoLink,
  resolveDemoLink,
} from '../demo'

describe('normalizeBookingUrl', () => {
  it('accepts an https scheduling URL', () => {
    expect(normalizeBookingUrl('https://cal.com/cansee/demo')).toBe('https://cal.com/cansee/demo')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeBookingUrl('  https://calendly.com/cansee/30min  ')).toBe(
      'https://calendly.com/cansee/30min',
    )
  })

  it.each([
    undefined,
    null,
    '',
    '   ',
    'not a url',
    'http://cal.com/cansee/demo',
    'javascript:alert(1)',
    'mailto:sales@cansee.ai',
    '/demo',
    42,
  ])('rejects %p', (raw) => {
    expect(normalizeBookingUrl(raw)).toBeNull()
  })
})

describe('demoMailtoHref', () => {
  it('builds an encoded mailto to the sales inbox', () => {
    expect(demoMailtoHref()).toBe(`mailto:${DEMO_SALES_EMAIL}?subject=Cansee%20demo%20request`)
  })
})

describe('resolveDemoLink', () => {
  it('uses the scheduler and marks it external when configured', () => {
    expect(resolveDemoLink('https://cal.com/cansee/demo')).toEqual({
      href: 'https://cal.com/cansee/demo',
      external: true,
    })
  })

  it('falls back to the mailto when unset or invalid', () => {
    for (const raw of [undefined, '', 'javascript:alert(1)']) {
      expect(resolveDemoLink(raw)).toEqual({ href: demoMailtoHref(), external: false })
    }
  })
})

describe('openDemoLink', () => {
  const fakeWindow = () => ({ open: vi.fn(), location: { href: '' } })

  it('opens a scheduler URL in a new tab without opener access', () => {
    const win = fakeWindow()
    openDemoLink('https://cal.com/cansee/demo', win)
    expect(win.open).toHaveBeenCalledWith('https://cal.com/cansee/demo', '_blank', 'noopener,noreferrer')
    expect(win.location.href).toBe('')
  })

  it('navigates the current window for a mailto', () => {
    const win = fakeWindow()
    openDemoLink('mailto:sales@cansee.ai', win)
    expect(win.open).not.toHaveBeenCalled()
    expect(win.location.href).toBe('mailto:sales@cansee.ai')
  })

  it('falls back to the sales mailto when no target is given', () => {
    const win = fakeWindow()
    openDemoLink(undefined, win)
    expect(win.location.href).toBe(demoMailtoHref())
  })
})
