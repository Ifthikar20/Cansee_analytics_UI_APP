import { onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from '@/stores/app'

/**
 * Pin <html> to one theme while the calling page is mounted.
 *
 * The landing page and the auth screens have a fixed look (dark) no matter
 * what the user picked in-app. Setting it on <html> rather than only on the
 * page root keeps the body, scrollbars and any teleported overlay in step.
 * On the way out the stored preference is re-applied, so the app never
 * inherits the forced theme. index.html applies the same rule before the
 * first paint (FORCED_DARK there) so a reload never flashes light.
 */
export function useForcedTheme(mode) {
  const app = useAppStore()

  function apply(value) {
    const root = document.documentElement
    root.setAttribute('data-theme', value)
    root.style.colorScheme = value
  }

  onMounted(() => apply(mode))
  // beforeUnmount, not unmounted: it runs before the next page's mounted
  // hook, so landing -> login hands dark straight to dark.
  onBeforeUnmount(() => apply(app.resolvedTheme))
}
