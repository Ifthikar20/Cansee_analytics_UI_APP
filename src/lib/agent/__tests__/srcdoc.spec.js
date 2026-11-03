import { describe, expect, it } from 'vitest'
import { PREVIEW_CSP, buildSrcdoc, sanitizePageHtml } from '../srcdoc'

const parse = (html) => new DOMParser().parseFromString(html, 'text/html')

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=https://evil.test">
<meta http-equiv="Content-Security-Policy" content="default-src *">
<meta name="referrer" content="unsafe-url">
<base href="https://evil.test/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
<link rel="stylesheet" href="https://evil.test/x.css">
<link rel="icon" href="https://evil.test/favicon.ico">
<style>body{color:#192118}</style>
<script>alert(1)</script>
<script type="application/ld+json">{"@type":"FAQPage"}</script>
</head>
<body onload="alert(1)">
<h1 onclick="alert(1)" class="hero">More rides.</h1>
<a href="javascript:alert(1)" id="js">bad</a>
<a href=" jav&#x09;ascript:alert(1)" id="js2">bad2</a>
<a href="data:text/html,<script>alert(1)</script>" id="data">data</a>
<a href="https://shop.test/guide" id="ok">ok</a>
<img src="data:image/png;base64,AAAA" id="img" onerror="alert(1)">
<iframe src="https://evil.test"></iframe>
<object data="x.swf"></object>
<embed src="x.swf">
<form action="https://evil.test"><button formaction="javascript:alert(1)">Go</button></form>
<svg><script>alert(1)</script><a href="javascript:alert(1)" id="svga"><text>t</text></a>
<animate attributeName="href" to="javascript:alert(1)"/><use href="https://evil.test/s.svg#x"/></svg>
<div style="background:url(javascript:alert(1))" id="styled">s</div>
</body>
</html>`

describe('buildSrcdoc', () => {
  const out = buildSrcdoc(PAGE)
  const doc = parse(out)

  it('starts with a doctype and puts the CSP first in head', () => {
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true)
    const first = doc.head.firstElementChild
    expect(first.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    expect(first.getAttribute('content')).toBe(PREVIEW_CSP)
    expect(doc.head.children[1].getAttribute('name')).toBe('referrer')
    expect(doc.head.children[1].getAttribute('content')).toBe('no-referrer')
    expect(doc.head.children[2].tagName).toBe('BASE')
    expect(doc.head.children[2].getAttribute('target')).toBe('_blank')
    expect(doc.head.children[2].hasAttribute('href')).toBe(false)
  })

  it('pins the expected policy', () => {
    expect(PREVIEW_CSP).toBe(
      "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data:; form-action 'none'; base-uri 'none'"
    )
  })

  it('removes scripts, frames, plugins, the original base and http-equiv metas', () => {
    expect(doc.querySelectorAll('script')).toHaveLength(0)
    expect(doc.querySelectorAll('iframe, object, embed')).toHaveLength(0)
    expect(doc.querySelectorAll('base')).toHaveLength(1)
    expect(doc.querySelectorAll('meta[http-equiv]')).toHaveLength(1)
    expect(doc.querySelectorAll('meta[name="referrer"]')).toHaveLength(1)
    expect(out).not.toContain('evil.test/x.css')
    expect(out).not.toContain('refresh')
  })

  it('keeps only Google Fonts stylesheets among links', () => {
    const links = doc.querySelectorAll('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toContain('fonts.googleapis.com/css2')
  })

  it('strips event handlers and script URLs', () => {
    expect(out).not.toMatch(/\son[a-z]+=/i)
    expect(doc.getElementById('js').hasAttribute('href')).toBe(false)
    expect(doc.getElementById('js2').hasAttribute('href')).toBe(false)
    expect(doc.getElementById('data').hasAttribute('href')).toBe(false)
    expect(doc.getElementById('ok').getAttribute('href')).toBe('https://shop.test/guide')
    expect(doc.getElementById('svga').hasAttribute('href')).toBe(false)
    expect(doc.getElementById('styled').hasAttribute('style')).toBe(false)
    expect(doc.querySelector('button').hasAttribute('formaction')).toBe(false)
  })

  it('keeps inline images, styles and content', () => {
    expect(doc.getElementById('img').getAttribute('src')).toBe('data:image/png;base64,AAAA')
    expect(doc.querySelector('style').textContent).toContain('#192118')
    expect(doc.querySelector('h1.hero').textContent).toBe('More rides.')
  })

  it('drops SVG animations that rewrite links and external use references', () => {
    expect(doc.querySelectorAll('animate')).toHaveLength(0)
    expect(doc.querySelectorAll('use')).toHaveLength(0)
  })

  it('handles empty and partial input from a streaming draft', () => {
    const empty = parse(buildSrcdoc(''))
    expect(empty.head.firstElementChild.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    const partial = parse(buildSrcdoc('<!DOCTYPE html><html><head><style>h1{color:red}</sty'))
    expect(partial.head.firstElementChild.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    expect(buildSrcdoc(null)).toContain('Content-Security-Policy')
  })
})

describe('sanitizePageHtml', () => {
  it('cleans without injecting the preview policy', () => {
    const out = sanitizePageHtml(PAGE)
    const doc = parse(out)
    expect(doc.querySelectorAll('script, iframe, base, meta[http-equiv]')).toHaveLength(0)
    expect(out).not.toContain(PREVIEW_CSP)
    expect(doc.querySelector('h1').hasAttribute('onclick')).toBe(false)
  })
})
