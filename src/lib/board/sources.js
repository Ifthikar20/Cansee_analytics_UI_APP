// The data sources the board's compact cards read (board_contract.md 5),
// through the existing API clients. SOURCES[key](wid) resolves with the
// payload. Cards read fixed windows (30 days, the latest checks); filters
// live in the expanded views. useBoardSource caches and shares the answers.
import api from '@/api/client'
import countriesApi from '@/api/countries'
import insightsApi from '@/api/insights'
import trafficApi from '@/api/traffic'
import visibilityApi from '@/api/visibility'

const PERIOD = Object.freeze({ period: '30d' })
const payload = (res) => res?.data ?? null

export const SOURCES = Object.freeze({
    overview: (wid) => api.get(`/search-gap/websites/${wid}/overview/`, { _silentError: true }).then(payload),
    visibility: (wid) => visibilityApi.dashboard(wid, { ...PERIOD }).then(payload),
    countryMatrix: (wid) => countriesApi.matrix(wid).then(payload),
    traffic: (wid) => trafficApi.traffic(wid, { ...PERIOD, source: 'auto' }).then(payload),
    aiTraffic: (wid) => trafficApi.aiTraffic(wid, { ...PERIOD, source: 'auto' }).then(payload),
    sentiment: (wid) => insightsApi.sentiment(wid, { ...PERIOD }).then(payload),
    factCheck: (wid) => insightsApi.factCheck(wid, { ...PERIOD }).then(payload),
    fanOuts: (wid) => insightsApi.fanOuts(wid, { ...PERIOD }).then(payload),
    pages: (wid) => insightsApi.pages(wid, { ...PERIOD }).then(payload),
    competitors: (wid) => insightsApi.competitors(wid, { ...PERIOD }).then(payload),
    crawlerAccess: (wid) => insightsApi.crawlerAccess(wid).then(payload),
    products: (wid) => insightsApi.products(wid).then(payload),
    promptIdeas: (wid) => insightsApi.promptIdeas(wid, { status: 'new' }).then(payload),
})

export const SOURCE_KEYS = Object.freeze(Object.keys(SOURCES))
