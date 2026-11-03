import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Page filters kept in the URL query (period, engine, prompt, source), so
 * a filtered view survives a reload and can be shared.
 *
 *   const { period, engine } = useQueryState(
 *     { period: '30d', engine: '' },
 *     { allowed: { period: ['7d', '30d', '90d'] } },
 *   )
 *
 * Each key becomes a writable computed: reading falls back to the default
 * for a missing or unknown value; writing replaces the query (no history
 * entry) and leaves defaults out of the URL.
 */
export function useQueryState(defaults, { allowed = {} } = {}) {
    const route = useRoute()
    const router = useRouter()
    const state = {}
    for (const key of Object.keys(defaults)) {
        state[key] = computed({
            get() {
                const raw = route.query[key]
                const value = Array.isArray(raw) ? raw[0] : raw
                if (value === undefined || value === null || value === '') return defaults[key]
                const ok = allowed[key]
                if (ok && !ok.includes(value)) return defaults[key]
                return String(value)
            },
            set(value) {
                const query = { ...route.query }
                if (value === undefined || value === null || value === '' || value === defaults[key]) delete query[key]
                else query[key] = String(value)
                router.replace({ query })
            },
        })
    }
    return state
}
