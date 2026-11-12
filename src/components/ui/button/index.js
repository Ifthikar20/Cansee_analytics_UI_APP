import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

// One button system. Primary is ink on paper and inverts on hover; nothing
// is a pill and nothing casts a shadow. Focus is the global 2px ink ring
// (assets/css/base.css), so no ring utilities here.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-transparent text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-primary',
        destructive: 'border-destructive bg-destructive text-destructive-foreground hover:bg-transparent hover:text-destructive',
        outline: 'border-input bg-transparent text-foreground hover:border-foreground hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-foreground hover:text-background',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
