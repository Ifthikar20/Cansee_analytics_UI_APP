import { cva } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

// Badges are small monospace labels in a square box. State is carried by
// weight and by the word, not by hue: "success" is an ink outline,
// "warning" and "destructive" wear the accent.
export const badgeVariants = cva(
  'inline-flex items-center border px-2 py-0.5 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.06em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-destructive bg-destructive text-destructive-foreground',
        outline: 'border-input text-foreground',
        success: 'border-foreground bg-transparent text-foreground',
        warning: 'border-transparent bg-signal-soft text-signal-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
