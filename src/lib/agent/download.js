// File downloads, clipboard and printing for pane exports.

const ILLEGAL = /[\\/:*?"<>|#%]+/g

// "Battery landing page" -> "Battery landing page.html". Strips characters
// Windows and macOS reject, control characters and leading dots.
export function safeFilename(name, ext) {
  let base = Array.from(String(name || ''))
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
  if (base.length > 80) base = base.slice(0, 80).trim()
  if (!base) base = 'export'
  const suffix = String(ext || '').replace(/^\.+/, '')
  return suffix ? `${base}.${suffix}` : base
}

export function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking right away cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(href), 30_000)
}

export function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), filename)
}

export async function copyText(text) {
  const value = String(text ?? '')
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {}
  // Fallback for insecure origins and older browsers.
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {}
  area.remove()
  return ok
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const DOC_CSS = `
:root{color-scheme:light}
body{margin:0;background:#fff;color:#0b0b0b;font:16px/1.625 Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:720px;margin:0 auto;padding:48px 24px 64px}
h1,h2,h3,h4{line-height:1.3;margin:1.6em 0 .6em}
h1{font-size:28px;margin-top:0}h2{font-size:22px}h3{font-size:18px}h4{font-size:16px}
p,ul,ol,blockquote,pre,table{margin:0 0 16px}
a{color:#0b0b0b;text-decoration:underline;text-underline-offset:2px}
blockquote{border-left:3px solid #e2e2dd;margin-left:0;padding-left:16px;color:#5c5c57}
code{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:.9em;background:#f2f2ef;border-radius:2px;padding:.1em .3em}
pre{background:#f7f7f5;border:1px solid #ebebe7;border-radius:2px;padding:12px 14px;overflow:auto}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border:1px solid #e6e6e1;padding:6px 10px;text-align:left;vertical-align:top}
th{background:#f7f7f5;font-weight:600}
hr{border:0;border-top:1px solid #e6e6e1;margin:24px 0}
button{display:none}
.ag-rh{border:1px solid #e6e6e1;border-radius:2px;padding:12px 16px;margin:0 0 24px;font-size:14px;line-height:1.5}
.ag-rh-top{margin:0 0 8px;font-weight:600}.ag-rh-sample{margin-left:8px;font-size:12px;text-transform:uppercase}
.ag-rh-list{margin:0}.ag-rh-row{display:flex;gap:12px}.ag-rh-row dt{flex:0 0 96px;color:#5c5c57}.ag-rh-row dd{margin:0}
.ag-rh-items,.ag-rh-engines{margin:0;padding:0;list-style:none}.ag-rh-engines li{display:inline;margin-right:14px}.ag-rh-muted{color:#5c5c57}
@media print{main{padding:0}a{color:inherit}pre,table,blockquote{break-inside:avoid}}
`

// A self-contained HTML document for the Markdown exports and printing.
// bodyHtml must already be sanitized.
export function standaloneHtml({ title, bodyHtml, lang = 'en' }) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title || 'Export')}</title>
<style>${DOC_CSS}</style>
</head>
<body>
<main>
${bodyHtml || ''}
</main>
</body>
</html>
`
}

// Prints a document through a hidden frame so the app itself is not
// printed. The frame runs no scripts (no allow-scripts); allow-same-origin
// lets this page call print() on it and allow-modals permits the dialog.
export function printHtml(html) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('tabindex', '-1')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
  let removed = false
  const cleanup = () => {
    if (removed) return
    removed = true
    frame.remove()
  }
  frame.addEventListener(
    'load',
    () => {
      const win = frame.contentWindow
      if (!win) return cleanup()
      try {
        win.addEventListener('afterprint', () => setTimeout(cleanup, 0))
        win.focus()
        win.print()
      } catch {
        cleanup()
        return
      }
      setTimeout(cleanup, 60_000)
    },
    { once: true }
  )
  frame.srcdoc = html
  document.body.appendChild(frame)
}
