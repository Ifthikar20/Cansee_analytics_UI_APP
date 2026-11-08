import { onBeforeUnmount, toValue, watch } from 'vue'
import { applyHead } from '@/lib/blog/head'

/**
 * Keep <head> in step with a page: title, description, canonical, Open
 * Graph and Twitter tags, and JSON-LD (see lib/blog/head.js for the spec).
 *
 * `source` is a spec, a ref or a getter; it is re-applied whenever it
 * changes, and undone when the page unmounts, so the next page gets the
 * index.html defaults back. A null spec leaves the head untouched.
 */
export function useHead(source) {
  let restore = null
  const undo = () => {
    if (restore) restore()
    restore = null
  }
  const stop = watch(
    () => toValue(source),
    (spec) => {
      undo()
      if (spec) restore = applyHead(document, spec)
    },
    { immediate: true, deep: true }
  )
  onBeforeUnmount(() => {
    stop()
    undo()
  })
}
