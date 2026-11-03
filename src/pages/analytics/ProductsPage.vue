<template>
  <div class="an-page">
    <AnalyticsHeader
      eyebrow="Shopping"
      title="Products"
      subtitle="Where your products show up in Google Shopping and whether the AI engines name them for shopping questions."
    >
      <template #actions>
        <Button variant="outline" class="rounded-full" :disabled="!data" @click="openAdd">
          <Plus class="size-4" aria-hidden="true" />
          Add product
        </Button>
        <Button class="rounded-full" :disabled="!products.length" @click="openCheck()">
          <ShoppingBag class="size-4" aria-hidden="true" />
          Run shopping check
        </Button>
      </template>
    </AnalyticsHeader>

    <p class="an-note">Engine answers come from the engines' APIs, not from the shopping cards in their apps.</p>

    <InsightRunProgress
      v-if="check.run.value"
      :run="check.run.value"
      :stopping="check.stopping.value"
      :stop-error="check.stopError.value"
      @stop="check.stop"
      @dismiss="check.dismiss"
    />

    <div v-if="!data && !error" class="an-skeleton" aria-busy="true" aria-label="Loading your products">
      <div class="an-kpis">
        <Skeleton v-for="n in 4" :key="n" class="h-28 rounded-2xl" />
      </div>
      <Skeleton class="h-64 rounded-2xl" />
    </div>

    <VizState v-else-if="!data && disabled" kind="disabled" title="Insights are turned off on this server." />

    <VizState
      v-else-if="!data"
      kind="error"
      title="We couldn't load your products."
      :action="{ label: 'Try again' }"
      @action="reload"
    />

    <template v-else>
      <Alert v-if="stale" variant="destructive" class="an-alert">
        <CircleX />
        <AlertTitle>We couldn't refresh this page. Showing the last loaded numbers.</AlertTitle>
        <AlertDescription>
          <button type="button" class="an-retry" @click="reload">Try again</button>
        </AlertDescription>
      </Alert>

      <Alert v-if="data.shopping && data.shopping.configured === false" class="an-alert">
        <CircleAlert />
        <AlertTitle>Google Shopping results need ScraperAPI on this server. Engine answers still work.</AlertTitle>
      </Alert>

      <VizState
        v-if="!products.length"
        kind="empty"
        title="No products tracked yet."
        body="Add a product with the shopping questions buyers ask. Cansee checks Google Shopping and asks the AI engines; you see the cost first."
        :action="{ label: 'Add product' }"
        @action="openAdd"
      />

      <template v-else>
        <section class="an-kpis" aria-label="Key numbers">
          <VizStatTile
            v-for="tile in tiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :kind="tile.kind || 'number'"
            :state-text="tile.stateText || 'Not measured'"
          />
        </section>

        <VizChart :spec="enginesSpec" :loading="loading" :heading-level="2" />

        <section class="an-card" aria-labelledby="pr-table-title">
          <h2 id="pr-table-title" class="an-section-title">Tracked products</h2>
          <div class="an-table-wrap" role="region" aria-label="Tracked products, scrolls sideways" tabindex="0">
            <table class="an-table">
              <caption class="sr-only">Tracked products</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Google Shopping</th>
                  <th scope="col">Sellers</th>
                  <th scope="col">Engines</th>
                  <th scope="col">Last checked</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id">
                  <th scope="row" class="pr-name">
                    <span class="pr-name-text">{{ row.name }}</span>
                    <span class="pr-terms">{{ row.terms }}</span>
                  </th>
                  <template v-if="row.checked">
                    <td class="pr-nowrap">
                      <span class="pr-value" :class="{ 'is-word': !row.google.measured }">{{ row.google.text }}</span>
                      <span v-if="row.google.sub" class="pr-sub">{{ row.google.sub }}</span>
                    </td>
                    <td class="pr-nowrap">
                      <span v-if="row.sellers">{{ row.sellers }}</span>
                      <span v-if="row.soldByYou" class="pr-badge">Sold by you</span>
                    </td>
                    <td class="pr-nowrap" :class="{ 'is-word': !row.engines.measured }">{{ row.engines.text }}</td>
                    <td class="pr-nowrap">
                      <span :title="row.checkedAt">{{ timeAgo(row.checkedAt) }}</span>
                    </td>
                  </template>
                  <td v-else colspan="4" class="pr-unchecked">
                    <span class="is-word">Not checked yet</span>
                    <button type="button" class="pr-link" @click="openCheck([row.id])">Run shopping check</button>
                  </td>
                  <td class="pr-actions">
                    <span class="pr-action-row">
                      <button type="button" class="pr-btn" @click="openDetail(row.product)">Details</button>
                      <button type="button" class="pr-btn" @click="openEdit(row.product)">Edit</button>
                      <button type="button" class="pr-btn" @click="askArchive(row.product)">Archive</button>
                      <AskAgentButton :website-id="websiteId" template="product" :values="row.ask" />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>

    <InsightRunDialog kind="shopping_check" :extra="dialogExtra" />
    <ProductDialog
      v-model:open="productOpen"
      :website-id="websiteId"
      :product="editing"
      :project-name="projectName"
      :limits="data?.limits || null"
      @saved="reload"
    />
    <ProductDetailSheet
      v-model:open="detailOpen"
      :website-id="websiteId"
      :product-id="detailProduct ? String(detailProduct.id) : ''"
      :product="detailProduct"
    />

    <AlertDialogRoot v-model:open="archiveOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="pr-overlay" />
        <AlertDialogContent class="pr-confirm" :aria-describedby="undefined">
          <AlertDialogTitle class="pr-confirm-title">Archive {{ archiving?.name }}? Its results are kept.</AlertDialogTitle>
          <p v-if="archiveError" class="pr-confirm-error" role="alert">{{ archiveError }}</p>
          <div class="pr-confirm-actions">
            <AlertDialogCancel as-child>
              <Button variant="outline" class="rounded-full">Cancel</Button>
            </AlertDialogCancel>
            <Button variant="destructive" class="rounded-full" :disabled="archiveBusy" @click="archive">Archive</Button>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </div>
</template>

<script setup>
// Products (contract 9): each tracked product's place in Google Shopping
// and whether the AI engines name it for the shopping questions buyers
// ask. A shopping check runs only after its cost is confirmed; adding or
// editing a product never runs one.
import { computed, ref } from 'vue'
import { CircleAlert, CircleX, Plus, ShoppingBag } from '@lucide/vue'
import {
  AlertDialogCancel, AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle,
} from 'reka-ui'
import insightsApi from '@/api/insights'
import { useAnalyticsQuery } from '@/composables/analytics/useAnalyticsQuery'
import { useInsightRun } from '@/composables/analytics/useInsightRun'
import { onSite, productEngines, productTiles, shoppingText, shoppingWord, siteHost } from '@/lib/analytics/productSpecs'
import { useAppStore } from '@/stores/app'
import { timeAgo } from '@/utils/timeAgo'
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader.vue'
import AskAgentButton from '@/components/analytics/AskAgentButton.vue'
import InsightRunDialog from '@/components/analytics/InsightRunDialog.vue'
import InsightRunProgress from '@/components/analytics/InsightRunProgress.vue'
import ProductDetailSheet from '@/components/analytics/ProductDetailSheet.vue'
import ProductDialog from '@/components/analytics/ProductDialog.vue'
import VizChart from '@/components/charts/VizChart.vue'
import VizStatTile from '@/components/charts/VizStatTile.vue'
import VizState from '@/components/charts/VizState.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps({
  websiteId: { type: String, required: true },
})

const appStore = useAppStore()
const integer = new Intl.NumberFormat('en-US')

const { data, loading, error, failure, stale, reload } = useAnalyticsQuery(
  () => insightsApi.products(props.websiteId).then((res) => res.data),
  () => [props.websiteId],
  { resetOn: () => props.websiteId },
)

const disabled = computed(() => failure.value?.code === 'insights_disabled')

const products = computed(() => data.value?.products || [])
const projectName = computed(() => appStore.activeWebsite?.name || '')
const host = computed(() => siteHost(appStore.activeWebsite?.url || ''))

const tiles = computed(() => productTiles(data.value))
const enginesSpec = computed(() => productEngines(data.value))

function enginesText(engines) {
  if (!engines || !(Number(engines.answers) > 0)) return { text: 'Not checked', measured: false }
  return { text: `${integer.format(engines.named || 0)} of ${integer.format(engines.answers)} answers`, measured: true }
}

const rows = computed(() =>
  products.value.map((p) => {
    const latest = p.latest || null
    const google = latest?.google || null
    const engines = latest?.engines || null
    const sellers = typeof google?.sellers === 'number' ? google.sellers : null
    return {
      id: String(p.id),
      product: p,
      name: p.name,
      terms: (p.match_terms || []).join(', '),
      checked: Boolean(latest),
      checkedAt: latest?.checked_at || '',
      google: shoppingText(google),
      sellers: sellers === null ? '' : `${integer.format(sellers)} ${sellers === 1 ? 'seller' : 'sellers'}`,
      soldByYou: Boolean(google?.sold_by_you),
      engines: enginesText(engines),
      ask: {
        product: p.name,
        google: shoppingWord(google),
        named: engines && Number(engines.answers) > 0 ? engines.named : null,
        answers: engines && Number(engines.answers) > 0 ? engines.answers : null,
        url: p.url || '',
        urlOnSite: onSite(p.url, host.value),
      },
    }
  }),
)

// ── The shopping check ──
const check = useInsightRun('shopping_check', { websiteId: () => props.websiteId, onFinished: () => reload() })

const dialogExtra = computed(() => ({
  products: products.value.map((p) => ({ id: String(p.id), name: p.name })),
  engines: data.value?.engines || [],
}))

const MAX_PER_RUN = 5

function openCheck(productIds = null) {
  const ids = productIds || products.value.slice(0, MAX_PER_RUN).map((p) => String(p.id))
  check.open({
    product_ids: ids,
    engines: (data.value?.engines || []).filter((e) => e.configured).map((e) => e.key),
    google_shopping: data.value?.shopping?.configured !== false,
  })
}

// ── Add, edit, details, archive ──
const productOpen = ref(false)
const editing = ref(null)

function openAdd() {
  editing.value = null
  productOpen.value = true
}

function openEdit(product) {
  editing.value = product
  productOpen.value = true
}

const detailOpen = ref(false)
const detailProduct = ref(null)

function openDetail(product) {
  detailProduct.value = product
  detailOpen.value = true
}

const archiveOpen = ref(false)
const archiving = ref(null)
const archiveBusy = ref(false)
const archiveError = ref('')

function askArchive(product) {
  archiving.value = product
  archiveError.value = ''
  archiveOpen.value = true
}

async function archive() {
  if (!archiving.value || archiveBusy.value) return
  archiveBusy.value = true
  archiveError.value = ''
  try {
    await insightsApi.archiveProduct(props.websiteId, archiving.value.id)
    archiveOpen.value = false
    reload()
  } catch (err) {
    const body = err?.response?.data?.error
    archiveError.value = (body && typeof body === 'object' && body.message) || "We couldn't archive this product. Try again."
  } finally {
    archiveBusy.value = false
  }
}
</script>

<style scoped>
/* minmax(0, 1fr): a wide chart or table never sets the page width. */
.an-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

.an-note {
  margin-top: -12px;
  color: var(--muted-foreground);
  font-size: 13px;
}

.an-skeleton {
  display: grid;
  gap: 16px;
}

.an-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.an-alert {
  border-radius: 14px;
}

.an-retry {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.an-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.an-section-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.an-table-wrap {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.an-table-wrap:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.an-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.an-table th,
.an-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.an-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.an-table tbody tr:last-child > * {
  border-bottom: 0;
}

.an-table .is-word {
  color: var(--muted-foreground);
}

.pr-name {
  min-width: 200px;
}

.pr-name-text {
  display: block;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.pr-terms {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 400;
}

.pr-nowrap {
  white-space: nowrap;
}

.pr-value {
  display: block;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pr-value.is-word {
  font-weight: 400;
}

.pr-sub {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
}

.pr-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}

.pr-link {
  margin-left: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.pr-actions {
  text-align: right !important;
}

.pr-action-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.pr-btn {
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.pr-btn:hover {
  background: var(--accent);
}

.pr-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(10, 10, 12, 0.45);
}

.pr-confirm {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 61;
  display: grid;
  gap: 14px;
  width: min(440px, calc(100vw - 32px));
  padding: 22px 24px 20px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%);
}

.pr-confirm-title {
  color: var(--foreground);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.pr-confirm-error {
  color: var(--destructive);
  font-size: 13px;
}

.pr-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1100px) {
  .an-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .an-card {
    padding: 16px;
  }
}
</style>
