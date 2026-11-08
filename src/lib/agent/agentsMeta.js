// Presentation metadata for the ten agents and the artifact kinds they
// write. Names and descriptions shown to users come from GET agents/ when
// it has loaded; the names here are the product's own labels, used before
// that and for ids the catalog does not list.
import { markRaw } from 'vue'
import {
    FileChartColumn as FileChartColumnIcon,
    FileCode as FileCodeIcon,
    FilePenLine as FilePenLineIcon,
    FileText as FileTextIcon,
    Megaphone as MegaphoneIcon,
    MessagesSquare as MessagesSquareIcon,
    Newspaper as NewspaperIcon,
    Scale as ScaleIcon,
    ScanSearch as ScanSearchIcon,
    Share2 as Share2Icon,
    SquareCode as SquareCodeIcon,
    SquareTerminal as SquareTerminalIcon,
    Table as TableIcon,
} from '@lucide/vue'
import { agentTeams } from './teams'
import { hidesUsd } from '@/lib/promptRuns'

// Raw so a consumer keeping this metadata in reactive state does not wrap
// the components in proxies.
const FileChartColumn = markRaw(FileChartColumnIcon)
const FileCode = markRaw(FileCodeIcon)
const FilePenLine = markRaw(FilePenLineIcon)
const FileText = markRaw(FileTextIcon)
const Megaphone = markRaw(MegaphoneIcon)
const MessagesSquare = markRaw(MessagesSquareIcon)
const Newspaper = markRaw(NewspaperIcon)
const Scale = markRaw(ScaleIcon)
const ScanSearch = markRaw(ScanSearchIcon)
const Share2 = markRaw(Share2Icon)
const SquareCode = markRaw(SquareCodeIcon)
const SquareTerminal = markRaw(SquareTerminalIcon)
const Table = markRaw(TableIcon)

// Catalog order of GET agents/ (p2_contract.md 12b).
export const AGENT_ORDER = Object.freeze([
    'gap_analyst',
    'page_optimizer',
    'aeo_article',
    'llms_txt',
    'comparison_page',
    'landing_page',
    'ad_campaign',
    'social_posts',
    'pr_writer',
    'messaging_brief',
])

export const AGENTS = Object.freeze({
    gap_analyst: {
        key: 'gap_analyst',
        name: 'Gap Analyst',
        outputKind: 'report',
        icon: ScanSearch,
    },
    page_optimizer: {
        key: 'page_optimizer',
        name: 'Page Optimizer',
        outputKind: 'document',
        icon: FilePenLine,
    },
    aeo_article: {
        key: 'aeo_article',
        name: 'AEO Article Agent',
        outputKind: 'document',
        icon: FileText,
    },
    llms_txt: {
        key: 'llms_txt',
        name: 'llms.txt Agent',
        outputKind: 'document',
        icon: FileCode,
    },
    comparison_page: {
        key: 'comparison_page',
        name: 'Comparison Page Agent',
        outputKind: 'document',
        icon: Scale,
    },
    landing_page: {
        key: 'landing_page',
        name: 'Landing Page Agent',
        outputKind: 'page',
        icon: SquareCode,
    },
    ad_campaign: {
        key: 'ad_campaign',
        name: 'Ad Campaign Agent',
        outputKind: 'sheet',
        icon: Megaphone,
    },
    social_posts: {
        key: 'social_posts',
        name: 'Social Posts Agent',
        outputKind: 'document',
        icon: Share2,
    },
    pr_writer: {
        key: 'pr_writer',
        name: 'PR Agent',
        outputKind: 'document',
        icon: Newspaper,
    },
    messaging_brief: {
        key: 'messaging_brief',
        name: 'Messaging Agent',
        outputKind: 'document',
        icon: MessagesSquare,
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
 * `teams` is [{key, label}], primary first: the catalog's when it sends
 * them, else the contract's (lib/agent/teams.js).
 */
export function agentMeta(key, catalog = null) {
    const base = AGENTS[key] || {
        key: String(key || ''),
        name: titleCase(key) || 'Agent',
        outputKind: null,
        icon: SquareCode,
    }
    const entry = Array.isArray(catalog) ? catalog.find((a) => a && a.key === key) : null
    if (!entry) return { ...base, description: '', starter: '', teams: agentTeams(key) }
    return {
        ...base,
        name: entry.name || base.name,
        description: entry.description || '',
        starter: entry.starter || '',
        outputKind: entry.output_kind || base.outputKind,
        teams: agentTeams(key, entry.teams),
    }
}

function usd(value) {
    const n = Number(value)
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return ''
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Why a writing agent cannot start now, or '' when it can or GET status/
 * does not say. status.writers[key] is {available, needs_usd}: whether the
 * remaining AI allowance covers the least that agent needs. Picking it
 * anyway would fail only after the orchestrator's turn was paid for.
 */
export function writerUnavailable(key, status = null) {
    const writers = status && typeof status.writers === 'object' ? status.writers : null
    const writer = writers ? writers[key] : null
    if (!writer || writer.available !== false) return ''
    // Free accounts never see dollars.
    if (hidesUsd(status)) return "Needs more of this month's free AI allowance than is left."
    const needs = usd(writer.needs_usd)
    const cap = Number(status.allowance?.cap_usd)
    const spent = Number(status.allowance?.spent_usd)
    const left = cap > 0 && Number.isFinite(spent) ? usd(Math.max(0, cap - spent)) : ''
    const head = needs ? `Needs at least ${needs} of AI allowance` : 'Needs more AI allowance than is left'
    return left ? `${head}; ${left} left this month.` : `${head}.`
}

/**
 * The ordered agent list: catalog order when loaded, else AGENT_ORDER.
 * With GET status/, each entry's `unavailable` says why it cannot start
 * now ('' when it can).
 */
export function agentList(catalog = null, status = null) {
    const list =
        Array.isArray(catalog) && catalog.length
            ? catalog.filter((a) => a && a.key).map((a) => agentMeta(a.key, catalog))
            : AGENT_ORDER.map((key) => agentMeta(key))
    return list.map((a) => ({ ...a, unavailable: writerUnavailable(a.key, status) }))
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

// The general writer of each kind; the six specialists also write documents.
const KIND_WRITERS = Object.freeze(['gap_analyst', 'landing_page', 'aeo_article', 'ad_campaign'])

/** The agent that writes a given artifact kind, or null. */
export function agentForKind(kind) {
    return KIND_WRITERS.map((k) => AGENTS[k]).find((a) => a.outputKind === kind) || null
}
