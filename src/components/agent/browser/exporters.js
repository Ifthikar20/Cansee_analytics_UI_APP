import { createApp, h } from 'vue'
import { ClipboardCopy, FileCode, FileDown, Printer, Sheet } from '@lucide/vue'
import { renderMarkdown } from '@/lib/agent/markdown/renderer'
import { UNSETTLED_HTML, sanitizePageHtml } from '@/lib/agent/srcdoc'
import { adCampaignRows, serpRows, toCsv, toTsv } from '@/lib/agent/csv'
import { copyText, downloadText, printHtml, safeFilename, standaloneHtml } from '@/lib/agent/download'
import { headerMarkdown } from '@/lib/agent/reportHeader'
import ReportHeader from './views/ReportHeader.vue'
import ResearchAppendix from './views/ResearchAppendix.vue'

// Export actions per pane content kind, and the files they produce.

const DOCUMENT_ACTIONS = [
  { key: 'md', label: 'Markdown (.md)', icon: FileDown },
  { key: 'doc-html', label: 'HTML (.html)', icon: FileCode },
  { key: 'print', label: 'Print or save as PDF', icon: Printer },
]

const ACTIONS = {
  page: [
    { key: 'page-html', label: 'Download HTML', icon: FileDown },
    { key: 'copy-html', label: 'Copy HTML', icon: ClipboardCopy },
  ],
  document: DOCUMENT_ACTIONS,
  report: DOCUMENT_ACTIONS,
  sheet: [
    { key: 'csv', label: 'CSV (.csv)', icon: FileDown },
    { key: 'tsv', label: 'TSV (.tsv)', icon: Sheet },
    { key: 'copy-table', label: 'Copy as table', icon: ClipboardCopy },
  ],
  serp: [{ key: 'serp-csv', label: 'Results as CSV', icon: FileDown }],
}

// A document's data type (p2_contract.md 12d) can add an action of its own.
const DATA_TYPE_ACTIONS = {
  llms_txt: [{ key: 'llms-txt', label: 'Download llms.txt', icon: FileDown }],
}

export function exportActions(kind, dataType = '') {
  const base = ACTIONS[kind] || []
  const extra = kind === 'document' ? DATA_TYPE_ACTIONS[dataType] || [] : []
  return [...extra, ...base]
}

// What to tell the user when runExport throws.
export function exportErrorText(err) {
  if (err?.message === UNSETTLED_HTML) return "This page's HTML couldn't be cleaned safely, so it wasn't exported."
  return "That export didn't work. Try again."
}

// Renders a component to static HTML (Vue escapes every text node).
export function componentHtml(Component, props) {
  const host = document.createElement('div')
  const app = createApp({ render: () => h(Component, props) })
  app.mount(host)
  const html = host.innerHTML
  app.unmount()
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/\sdata-v-[a-z0-9]+=""/g, '')
}

// data.header of a report version, or null (reports saved before headers).
function reportHeaderOf(data) {
  const header = data?.header
  return header && typeof header === 'object' && !Array.isArray(header) ? header : null
}

const templateOf = (data) => (typeof data?.template === 'string' ? data.template : null)

// A standalone HTML file for a Markdown document; a report gets its header
// first and the research appendix last. Copy buttons from code blocks are
// left out.
export function documentHtml({ title, markdown, data = null, report = false }) {
  const tpl = document.createElement('template')
  tpl.innerHTML = renderMarkdown(markdown || '')
  tpl.content.querySelectorAll('button').forEach((el) => el.remove())
  let body = tpl.innerHTML
  const header = report ? reportHeaderOf(data) : null
  if (header) body = componentHtml(ReportHeader, { header, template: templateOf(data) }) + body
  if (report) body += componentHtml(ResearchAppendix, { data, expanded: true })
  return standaloneHtml({ title, bodyHtml: body })
}

// The Markdown file: a report's header as a short list ahead of its text.
export function documentMarkdown({ markdown, data = null, report = false }) {
  const header = report ? reportHeaderOf(data) : null
  return (header ? headerMarkdown(header, templateOf(data)) : '') + (markdown || '')
}

// ctx: {title, content, data, sheet, capture, kind}. Resolves to a short
// confirmation for copy actions, '' otherwise; throws when there is nothing
// to export.
export async function runExport(key, ctx) {
  const title = ctx.title || 'Export'
  switch (key) {
    case 'page-html':
      downloadText(sanitizePageHtml(ctx.content || ''), safeFilename(title, 'html'), 'text/html;charset=utf-8')
      return ''
    case 'copy-html':
      if (!(await copyText(sanitizePageHtml(ctx.content || '')))) throw new Error('copy_failed')
      return 'HTML copied'
    case 'md':
      downloadText(
        documentMarkdown({ markdown: ctx.content, data: ctx.data, report: ctx.kind === 'report' }),
        safeFilename(title, 'md'),
        'text/markdown;charset=utf-8'
      )
      return ''
    case 'llms-txt':
      // The file name the llms.txt convention expects at the site root.
      downloadText(ctx.content || '', 'llms.txt', 'text/plain;charset=utf-8')
      return ''
    case 'doc-html':
      downloadText(
        documentHtml({ title, markdown: ctx.content, data: ctx.data, report: ctx.kind === 'report' }),
        safeFilename(title, 'html'),
        'text/html;charset=utf-8'
      )
      return ''
    case 'print':
      printHtml(documentHtml({ title, markdown: ctx.content, data: ctx.data, report: ctx.kind === 'report' }))
      return ''
    case 'csv':
      downloadText(toCsv(adCampaignRows(ctx.sheet)), safeFilename(title, 'csv'), 'text/csv;charset=utf-8')
      return ''
    case 'tsv':
      downloadText(toTsv(adCampaignRows(ctx.sheet)), safeFilename(title, 'tsv'), 'text/tab-separated-values;charset=utf-8')
      return ''
    case 'copy-table':
      if (!(await copyText(toTsv(adCampaignRows(ctx.sheet))))) throw new Error('copy_failed')
      return 'Copied. Paste it into a spreadsheet.'
    case 'serp-csv':
      downloadText(toCsv(serpRows(ctx.capture)), safeFilename(title, 'csv'), 'text/csv;charset=utf-8')
      return ''
    default:
      throw new Error('unknown_export')
  }
}
