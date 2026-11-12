<template>
  <div class="ag-newtab">
    <div class="ag-newtab-inner">
      <h2 class="ag-newtab-title">Open a web page</h2>
      <p class="ag-newtab-sub">
        Pages open live when the site allows it, otherwise in a reader view. Either way you get the page's on-page SEO
        facts.
      </p>
      <UrlBar autofocus @submit="open" />
      <div v-if="site" class="ag-newtab-quick">
        <p class="ag-newtab-label">Your project</p>
        <button type="button" class="ag-newtab-site" @click="open(site.url)">
          <span class="ag-newtab-avatar" aria-hidden="true">{{ firstLetter(site.name || site.host) }}</span>
          <span class="ag-newtab-site-text">
            <span class="ag-newtab-site-name">{{ site.name || site.host }}</span>
            <span class="ag-newtab-site-host">{{ site.host }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAgentPaneStore } from '@/stores/agentPane'
import { useAgentStore } from '@/stores/agent'
import { useAppStore } from '@/stores/app'
import { firstLetter, hostOf, normalizeAddress } from '@/lib/agent/url'
import UrlBar from '../UrlBar.vue'

const props = defineProps({
  tab: { type: Object, required: true },
})

const pane = useAgentPaneStore()
const agent = useAgentStore()
const app = useAppStore()

// The current project's own site, when it has an address.
const site = computed(() => {
  const wid = agent.websiteId ?? app.activeWebsite?.id
  const website = app.websites.find((w) => String(w.id) === String(wid)) || app.activeWebsite
  const url = normalizeAddress(String(website?.url || ''))
  if (!url) return null
  return { url, name: website.name || '', host: hostOf(url) }
})

function open(url) {
  pane.navigateTab(props.tab.id, url)
}
</script>

<style scoped>
.ag-newtab {
  box-sizing: border-box;
  min-height: 100%;
  padding: 72px 24px 48px;
}

.ag-newtab-inner {
  max-width: 520px;
  margin: 0 auto;
}

.ag-newtab-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.ag-newtab-sub {
  margin: 6px 0 20px;
  color: var(--ag-fg-2);
  font-size: 14px;
  line-height: 21px;
}

.ag-newtab-quick {
  margin-top: 28px;
}

.ag-newtab-label {
  margin: 0 0 8px;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
}

.ag-newtab-site {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 360px;
  padding: 10px 12px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
  background: transparent;
  color: var(--ag-fg-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.ag-newtab-site:hover {
  background: var(--ag-ghost-hover);
}

.ag-newtab-site:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-newtab-avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--ag-iconbox-border);
  border-radius: var(--radius);
  background: var(--ag-logo-bg);
  color: var(--ag-logo-fg);
  font-size: 13px;
  font-weight: 700;
}

.ag-newtab-site-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ag-newtab-site-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-newtab-site-host {
  overflow: hidden;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
