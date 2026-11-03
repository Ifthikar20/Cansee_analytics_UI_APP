// Central Chart.js theme for Cansee.
//
// One palette, one tooltip style, one grid treatment — every chart in the
// app imports from here so the product reads as a single system. The
// palette leads with dark blue and orange (high-contrast, print-safe,
// readable in light and dark themes); deliberately no yellow and no
// green-vs-red traffic-light coloring for series data.

export const CHART_COLORS = {
  blue: '#1d4ed8',      // primary series — dark blue
  orange: '#f97316',    // comparison/highlight series — orange
  sky: '#0ea5e9',       // tertiary
  navy: '#1e3a8a',      // deep anchor (stacked bases, emphasis)
  amberDark: '#c2410c', // burnt orange for dense multi-series
  slate: '#64748b',     // "other" / remainder buckets
}

function withAlpha(hex, alpha) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
}

function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

// Shared scaffolding for options objects. Spread into a chart's options and
// override what the specific chart needs.
export function baseOptions() {
  const text = cssVar('--muted-foreground', '#717171')
  const popover = cssVar('--popover', '#ffffff')
  const popoverFg = cssVar('--popover-foreground', '#222222')
  const border = cssVar('--border', '#e5e7eb')
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyleWidth: 8,
          boxHeight: 6,
          color: text,
          font: { size: 11, weight: '600' },
        },
      },
      tooltip: {
        usePointStyle: true,
        backgroundColor: popover,
        titleColor: text,
        bodyColor: popoverFg,
        borderColor: border,
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        boxPadding: 5,
        titleFont: { weight: '600', size: 11 },
        bodyFont: { weight: '600', size: 12 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: text, font: { size: 11, weight: '600' }, padding: 6 },
      },
      y: {
        grid: { color: withAlpha('#94a3b8', 0.15) },
        border: { display: false },
        ticks: { color: text, font: { size: 10 }, maxTicksLimit: 5, padding: 6 },
      },
    },
  }
}

// Rounded vertical bars in the house style (chartjs bar sample, tightened).
export function barDataset(label, data, color, overrides = {}) {
  return {
    label,
    data,
    backgroundColor: withAlpha(color, 0.85),
    hoverBackgroundColor: color,
    borderRadius: 5,
    borderSkipped: false,
    maxBarThickness: 28,
    ...overrides,
  }
}
