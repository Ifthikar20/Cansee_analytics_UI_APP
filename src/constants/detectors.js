// Presentation config for the Brand Security detector taxonomy.
//
// The taxonomy itself (codes, names, categories, descriptions,
// recommended actions) comes from GET /brand-security/taxonomy/ — the
// backend detector registry is the single source of truth. This module
// only maps backend category keys to icons and badge styling, and keeps
// a legacy issue-code map so alerts written before detector codes
// existed still render a sensible category.
import {
  Frown,
  Landmark,
  MessageSquareWarning,
  ScanFace,
  Scale,
  ShieldAlert,
  ShieldQuestion,
  Swords,
} from '@lucide/vue'

// Keyed by the backend registry's category keys (see detectors.py
// CATEGORIES). Badge classes use semantic/severity tokens only.
export const CATEGORY_PRESENTATION = {
  sentiment: {
    label: 'Sentiment',
    blurb: 'Negative or lukewarm tone in mentions of your brand',
    icon: Frown,
    badgeClass: 'bg-severity-medium/10 text-severity-medium',
  },
  language: {
    label: 'Language',
    blurb: 'Derogatory or insulting wording about your brand',
    icon: MessageSquareWarning,
    badgeClass: 'bg-severity-high/10 text-severity-high',
  },
  association: {
    label: 'Association',
    blurb: 'Your brand tied to fraud, legal or reliability risk language',
    icon: Landmark,
    badgeClass: 'bg-severity-high/10 text-severity-high',
  },
  competitive: {
    label: 'Competitive',
    blurb: 'A competitor favored or recommended over your brand',
    icon: Swords,
    badgeClass: 'bg-accent text-accent-foreground',
  },
  accuracy: {
    label: 'Accuracy',
    blurb: 'Factual claims that contradict your Brand Ingestion material',
    icon: Scale,
    badgeClass: 'bg-severity-high/10 text-severity-high',
  },
  identity: {
    label: 'Identity',
    blurb: 'Your name folded into another brand or misattributed',
    icon: ScanFace,
    badgeClass: 'bg-accent text-accent-foreground',
  },
  trust: {
    label: 'Trust',
    blurb: 'Caution advice or legitimacy doubt attached to your brand',
    icon: ShieldQuestion,
    badgeClass: 'bg-severity-medium/10 text-severity-medium',
  },
  privacy: {
    label: 'Privacy',
    blurb: 'Private or non-public data about your brand surfacing in an answer',
    icon: ShieldAlert,
    badgeClass: 'bg-severity-high/10 text-severity-high',
  },
  security: {
    label: 'Security',
    blurb: 'Unsupported compliance claims, unconfirmed incidents, or advice against your brand on security grounds',
    icon: ShieldAlert,
    badgeClass: 'bg-severity-high/10 text-severity-high',
  },
}

export const FALLBACK_CATEGORY = {
  key: 'other',
  label: 'Brand mention',
  blurb: 'Your brand was mentioned somewhere we monitor',
  icon: ShieldQuestion,
  badgeClass: 'bg-secondary text-secondary-foreground',
}

// Legacy issue code -> category key, for alerts predating detector codes
// (including rows from the external-source agents, which only carry an
// issue). Mirrors ISSUE_FALLBACK in the backend registry.
export const LEGACY_ISSUE_CATEGORY = {
  negative: 'sentiment',
  sentiment_drop: 'sentiment',
  weak_endorsement: 'sentiment',
  derogatory: 'language',
  harmful: 'association',
  unfavorable_comparison: 'competitive',
  hallucination: 'accuracy',
  unverified: 'accuracy',
  outdated: 'accuracy',
  sge_misrepresentation: 'accuracy',
  impersonation: 'identity',
  distrust: 'trust',
  emerging_narrative: 'trust',
  negative_outranking: 'association',
  ranking_for_bad_query: 'association',
  private_data: 'privacy',
  hallucinated_compliance: 'security',
  false_incident: 'security',
  security_advisory: 'security',
}

export function categoryPresentation(key) {
  const preset = CATEGORY_PRESENTATION[key]
  if (!preset) return { ...FALLBACK_CATEGORY }
  return { key, ...preset }
}

// Resolve an alert's category: its detector (via the fetched taxonomy)
// wins; otherwise fall back by legacy issue code.
export function categoryForAlert(alert, detectorByCode) {
  const detector =
    (alert?.detector_code && detectorByCode?.(alert.detector_code)) ||
    alert?.detector ||
    null
  if (detector?.category && CATEGORY_PRESENTATION[detector.category]) {
    return categoryPresentation(detector.category)
  }
  const legacy = LEGACY_ISSUE_CATEGORY[alert?.issue]
  if (legacy) return categoryPresentation(legacy)
  return { ...FALLBACK_CATEGORY }
}

// Friendly labels for where a finding was captured.
export const SOURCE_LABELS = {
  llm: 'LLM answer',
  serp: 'Search results',
  reddit: 'Reddit',
  x: 'X',
  trends: 'Google Trends',
  web: 'Web',
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || (source ? source.toUpperCase() : '-')
}
