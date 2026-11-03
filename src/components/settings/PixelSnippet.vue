<template>
  <div class="px">
    <p v-if="loading" class="px-muted">Loading the snippet...</p>
    <div v-else-if="loadFailed" class="px-failed">
      <p class="px-muted">We couldn't load the snippet.</p>
      <Button variant="outline" size="sm" class="px-btn" @click="load">Try again</Button>
    </div>
    <template v-else>
      <pre class="px-code" tabindex="0" aria-label="Pixel snippet"><code>{{ snippet }}</code></pre>
      <div class="px-actions">
        <Button size="sm" class="px-btn" @click="copy">
          <Copy class="size-4" aria-hidden="true" />
          Copy snippet
        </Button>
        <Button variant="outline" size="sm" class="px-btn" :disabled="checking" @click="verify">
          {{ checking ? 'Checking...' : 'Check installation' }}
        </Button>
      </div>
      <p v-if="notFound" class="px-error" role="alert">
        We couldn't find the pixel on {{ websiteUrl || 'your site' }}. Put the snippet in the page's head, publish, then check
        again.
      </p>
    </template>
  </div>
</template>

<script setup>
// The Cansee pixel's snippet for a project, read-only, with a copy button
// and an installation check (the server fetches the site and looks for
// the project's pixel key).
import { ref, watch } from 'vue'
import { Copy } from '@lucide/vue'
import webAnalyticsApi from '@/api/webAnalytics'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'

const props = defineProps({
  websiteId: { type: String, required: true },
  // The site the check fetches, for the messages.
  websiteUrl: { type: String, default: '' },
})
const emit = defineEmits(['verified'])

const toast = useToast()

const snippet = ref('')
const loading = ref(false)
const loadFailed = ref(false)
const checking = ref(false)
const notFound = ref(false)

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

async function load() {
  const id = props.websiteId
  loading.value = true
  loadFailed.value = false
  try {
    const res = await webAnalyticsApi.pixel(id)
    if (id !== props.websiteId) return
    snippet.value = res.data?.snippet || ''
  } catch {
    if (id === props.websiteId) loadFailed.value = true
  } finally {
    if (id === props.websiteId) loading.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    toast.success('Snippet copied.')
  } catch {
    toast.error("We couldn't copy the snippet.")
  }
}

async function verify() {
  checking.value = true
  notFound.value = false
  try {
    const res = await webAnalyticsApi.verifyPixel(props.websiteId)
    if (res.data?.verified) {
      toast.success(`The pixel is on ${hostOf(props.websiteUrl) || 'your site'}.`)
      emit('verified')
    } else {
      notFound.value = true
    }
  } catch {
    notFound.value = true
  } finally {
    checking.value = false
  }
}

watch(
  () => props.websiteId,
  () => {
    snippet.value = ''
    notFound.value = false
    load()
  },
  { immediate: true },
)
</script>

<style scoped>
.px {
  display: grid;
  gap: 12px;
}

.px-muted {
  color: var(--muted-foreground);
  font-size: 13px;
}

.px-failed {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.px-code {
  max-height: 180px;
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--muted);
  color: var(--foreground);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}

.px-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.px-btn {
  border-radius: 10px;
}

.px-error {
  color: var(--destructive);
  font-size: 13px;
  line-height: 1.5;
}
</style>
