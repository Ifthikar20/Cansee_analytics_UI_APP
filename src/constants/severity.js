// Severity presentation for Brand Security — the single module every
// brand-security surface imports. Colors flow through the --severity-*
// tokens (defined for both themes in assets/tailwind.css), never raw hex.
const SEVERITY_META = {
  high: {
    label: 'High',
    rank: 0,
    badgeClass: 'border-severity-high/25 bg-severity-high/10 text-severity-high',
    dotClass: 'bg-severity-high',
    textClass: 'text-severity-high',
  },
  medium: {
    label: 'Medium',
    rank: 1,
    badgeClass: 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium',
    dotClass: 'bg-severity-medium',
    textClass: 'text-severity-medium',
  },
  low: {
    label: 'Low',
    rank: 2,
    badgeClass: 'border-severity-low/25 bg-severity-low/10 text-severity-low',
    dotClass: 'bg-severity-low',
    textClass: 'text-severity-low',
  },
}

export function severityMeta(severity) {
  return SEVERITY_META[severity] || SEVERITY_META.low
}

// Sort comparator: high before medium before low, for alert objects.
export function compareSeverity(a, b) {
  return severityMeta(a.severity).rank - severityMeta(b.severity).rank
}
