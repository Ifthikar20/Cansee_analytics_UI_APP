// The newest report's detail for the Latest report block: its structured
// header names the template and the engines, which the list does not
// carry. One request per report version, shared by the card and its panel;
// a failure is silent and the cover then shows what the list gave.
import { shallowRef, toValue, watch } from 'vue'
import agentApi from '@/api/agent'

const MAX_KEPT = 12
const kept = new Map()
const inflight = new Map()

function fetchDetail(key, wid, id) {
    let request = inflight.get(key)
    if (!request) {
        request = Promise.resolve()
            .then(() => agentApi.getArtifact(wid, id, { _silentError: true }))
            .then((res) => {
                const data = res?.data
                if (!data || typeof data !== 'object') return null
                kept.set(key, data)
                if (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value)
                return data
            })
            .catch(() => null)
            .finally(() => inflight.delete(key))
        inflight.set(key, request)
    }
    return request
}

/** Forget every detail (tests, sign-out). */
export function resetReportDetails() {
    kept.clear()
    inflight.clear()
}

/**
 * The ArtifactDetail of `report` ({id, version}; a ref, getter or value)
 * in project `websiteId`, as a ref: null until it loads, when it fails
 * and without a report.
 */
export function useReportDetail(websiteId, report) {
    const detail = shallowRef(null)
    const keyOf = () => {
        const wid = toValue(websiteId)
        const r = toValue(report)
        return wid && r?.id ? `${wid}|${r.id}@${r.version ?? ''}` : ''
    }
    watch(
        keyOf,
        (key) => {
            detail.value = (key && kept.get(key)) || null
            if (!key || detail.value) return
            const wid = String(toValue(websiteId))
            const id = String(toValue(report).id)
            fetchDetail(key, wid, id).then((data) => {
                if (keyOf() === key) detail.value = data
            })
        },
        { immediate: true },
    )
    return detail
}
