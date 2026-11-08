// How each kind of source looks in the attribution views
// (attribution_contract.md 1, Source types). `type` and `owner` choose the
// icon and color only; the words shown always come from the API's
// `type_label`. Pure: static data and lookups.
import {
    BookOpen,
    CircleHelp,
    FileText,
    Globe,
    GraduationCap,
    House,
    Info,
    Landmark,
    Library,
    LifeBuoy,
    MessageSquare,
    MessagesSquare,
    Newspaper,
    Package,
    PenLine,
    Scale,
    Share2,
    ShieldCheck,
    Star,
    Swords,
    Tag,
    Video,
} from '@lucide/vue'
import { normalizeOwner } from './answerHtml'

export const OWNER_META = Object.freeze({
    you: Object.freeze({ label: 'Yours', className: 'att-owner--you' }),
    competitor: Object.freeze({ label: 'Competitor', className: 'att-owner--competitor' }),
    third_party: Object.freeze({ label: 'Third party', className: 'att-owner--third_party' }),
})

export const TYPE_ICONS = Object.freeze({
    homepage: House,
    blog: PenLine,
    docs: BookOpen,
    pricing: Tag,
    product: Package,
    about: Info,
    terms: Scale,
    privacy: ShieldCheck,
    legal: Scale,
    support: LifeBuoy,
    page: FileText,
    competitor: Swords,
    reddit: MessageSquare,
    review: Star,
    forum: MessagesSquare,
    qa: CircleHelp,
    news: Newspaper,
    wikipedia: Library,
    social: Share2,
    video: Video,
    gov: Landmark,
    edu: GraduationCap,
    other: Globe,
})

export const CONFIDENCE_META = Object.freeze({
    confirmed: Object.freeze({
        label: 'Confirmed',
        hint: 'The engine cited this page for this part of the answer.',
        className: 'att-conf--confirmed',
    }),
    likely: Object.freeze({
        label: 'Likely',
        hint: 'Found by analysis. The same words appear on the page.',
        className: 'att-conf--likely',
    }),
})

/**
 * Display data for a finding's `source`: {owner, ownerLabel, ownerClass,
 * icon, label}. Unknown types fall back to a page (own site) or globe icon.
 */
export function sourceStyle(source) {
    const owner = normalizeOwner(source?.owner)
    const meta = OWNER_META[owner]
    const icon = TYPE_ICONS[source?.type] || (owner === 'you' ? FileText : Globe)
    const label = typeof source?.type_label === 'string' && source.type_label.trim() ? source.type_label.trim() : 'Source'
    return { owner, ownerLabel: meta.label, ownerClass: meta.className, icon, label }
}

/** {label, hint, className} for a finding's confidence; unknown values read as Likely. */
export function confidenceMeta(confidence) {
    return CONFIDENCE_META[confidence] || CONFIDENCE_META.likely
}
