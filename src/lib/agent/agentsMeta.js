// Presentation metadata for the four agents and the artifact kinds they
// write. Names and descriptions shown to users come from GET agents/ when
// it has loaded; the names here are the product's own labels, used before
// that and for ids the catalog does not list.
import { markRaw } from 'vue'
import {
    FileChartColumn as FileChartColumnIcon,
    FileText as FileTextIcon,
    Megaphone as MegaphoneIcon,
    ScanSearch as ScanSearchIcon,
    SquareCode as SquareCodeIcon,
    SquareTerminal as SquareTerminalIcon,
    Table as TableIcon,
} from '@lucide/vue'

// Raw so a consumer keeping this metadata in reactive state does not wrap
// the components in proxies.
const FileChartColumn = markRaw(FileChartColumnIcon)
const FileText = markRaw(FileTextIcon)
const Megaphone = markRaw(MegaphoneIcon)
const ScanSearch = markRaw(ScanSearchIcon)
const SquareCode = markRaw(SquareCodeIcon)
const SquareTerminal = markRaw(SquareTerminalIcon)
const Table = markRaw(TableIcon)

export const AGENT_ORDER = Object.freeze(['gap_analyst', 'landing_page', 'aeo_article', 'ad_campaign'])

export const AGENTS = Object.freeze({
    gap_analyst: {
        key: 'gap_analyst',
        name: 'Gap Analyst',
        outputKind: 'report',
        icon: ScanSearch,
    },
    landing_page: {
        key: 'landing_page',
        name: 'Landing Page Agent',
        outputKind: 'page',
        icon: SquareCode,
    },
    aeo_article: {
        key: 'aeo_article',
        name: 'AEO Article Agent',
        outputKind: 'document',
        icon: FileText,
    },
    ad_campaign: {
        key: 'ad_campaign',
        name: 'Ad Campaign Agent',
        outputKind: 'sheet',
        icon: Megaphone,
    },
})

// `color` is a token name from assets/agent/tokens.css.
export const ARTIFACT_KINDS = Object.freeze({
    page: {
        kind: 'page',
        label: 'Landing page',
        plural: 'Landing pages',
        icon: SquareTerminal,
        color: 'var(--ag-accent)',
        contentType: 'text/html',
    },
    document: {
        kind: 'document',
        label: 'Document',
        plural: 'Documents',
        icon: FileText,
        color: 'var(--ag-kind-doc)',
        contentType: 'text/markdown',
    },
    sheet: {
        kind: 'sheet',
        label: 'Sheet',
        plural: 'Sheets',
        icon: Table,
        color: 'var(--ag-kind-sheet)',
        contentType: 'application/json',
    },
    report: {
        kind: 'report',
        label: 'Report',
        plural: 'Reports',
        icon: FileChartColumn,
        color: 'var(--ag-kind-report)',
        contentType: 'text/markdown',
    },
})

function titleCase(key) {
    return String(key || '')
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

/**
 * Metadata for an agent key, merged with its catalog entry when given
 * (`catalog` is the GET agents/ list). Unknown keys get a neutral entry.
 */
export function agentMeta(key, catalog = null) {
    const base = AGENTS[key] || {
        key: String(key || ''),
        name: titleCase(key) || 'Agent',
        outputKind: null,
        icon: SquareCode,
    }
    const entry = Array.isArray(catalog) ? catalog.find((a) => a && a.key === key) : null
    if (!entry) return { ...base, description: '', starter: '' }
    return {
        ...base,
        name: entry.name || base.name,
        description: entry.description || '',
        starter: entry.starter || '',
        outputKind: entry.output_kind || base.outputKind,
    }
}

/** The ordered agent list: catalog order when loaded, else AGENT_ORDER. */
export function agentList(catalog = null) {
    if (Array.isArray(catalog) && catalog.length) {
        return catalog.filter((a) => a && a.key).map((a) => agentMeta(a.key, catalog))
    }
    return AGENT_ORDER.map((key) => agentMeta(key))
}

export function kindMeta(kind) {
    return (
        ARTIFACT_KINDS[kind] || {
            kind: String(kind || ''),
            label: titleCase(kind) || 'Artifact',
            plural: titleCase(kind) || 'Artifacts',
            icon: FileText,
            color: 'var(--ag-fg-2)',
            contentType: '',
        }
    )
}

/** The agent that writes a given artifact kind, or null. */
export function agentForKind(kind) {
    return AGENT_ORDER.map((k) => AGENTS[k]).find((a) => a.outputKind === kind) || null
}
