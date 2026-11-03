<template>
  <section class="gc" aria-labelledby="gc-title">
    <header class="gc-head">
      <h2 id="gc-title" class="gc-title">
        <span class="gc-g" aria-hidden="true">G</span>
        Google
      </h2>
      <span v-if="google.checked_at" class="gc-when">Checked {{ timeAgo(google.checked_at) }}</span>
    </header>

    <div class="gc-rank">
      <template v-if="google.status === 'ok' && google.position">
        <span class="gc-rank-value">#{{ google.position }}</span>
        <span class="gc-rank-meta">Page {{ google.page }} · search score {{ google.score }}</span>
      </template>
      <template v-else-if="google.status === 'ok'">
        <span class="gc-rank-value gc-rank-none">Not ranked</span>
        <span class="gc-rank-meta">Not in Google's top {{ google.depth }} results</span>
      </template>
      <template v-else-if="!available">
        <span class="gc-rank-value gc-rank-none">Not checked</span>
        <span class="gc-rank-meta">Google rank checks aren't available yet.</span>
      </template>
      <template v-else-if="google.status === 'error'">
        <span class="gc-rank-value gc-rank-none">Check failed</span>
        <span class="gc-rank-meta">Use Check now to try again.</span>
      </template>
      <template v-else>
        <span class="gc-rank-value gc-rank-none">Not checked</span>
        <span class="gc-rank-meta">Use Check now to compare Google with the AI answers.</span>
      </template>
    </div>

    <a v-if="google.url" :href="google.url" target="_blank" rel="noopener" class="gc-url">
      {{ shortUrl(google.url) }}
      <ExternalLink class="gc-ext" aria-hidden="true" />
    </a>

    <div v-if="google.top_results?.length" class="gc-block">
      <h3 class="gc-sub">What you're up against on page one</h3>
      <ol class="gc-results">
        <li
          v-for="r in google.top_results"
          :key="r.position"
          class="gc-result"
          :class="{ 'is-you': r.is_yours }"
        >
          <span class="gc-pos">{{ r.position }}</span>
          <a :href="r.url" target="_blank" rel="noopener" class="gc-domain" :title="r.title">{{ r.domain }}</a>
          <span v-if="r.is_yours" class="gc-tag gc-tag-you">You</span>
          <span v-else-if="r.is_competitor" class="gc-tag">Competitor</span>
        </li>
      </ol>
    </div>

    <div v-if="aiOverview.shown" class="gc-block">
      <h3 class="gc-sub">Google's AI Overview</h3>
      <p class="gc-line">
        {{ aiOverview.mentions_you ? 'Mentions you' : "Doesn't mention you" }}
        · {{ aiOverview.cites_you ? 'cites your site' : "doesn't cite your site" }}
      </p>
    </div>

    <div class="gc-block">
      <h3 class="gc-sub">Search Console</h3>
      <dl v-if="google.gsc" class="gc-gsc">
        <div><dt>Clicks</dt><dd>{{ google.gsc.clicks }}</dd></div>
        <div><dt>Impressions</dt><dd>{{ google.gsc.impressions }}</dd></div>
        <div><dt>Avg. position</dt><dd>{{ google.gsc.avg_position }}</dd></div>
      </dl>
      <p v-else class="gc-line">
        No Search Console data for this exact query.
        <router-link to="/settings/connections" class="gc-link">Search Console settings</router-link>
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { timeAgo } from '@/utils/timeAgo'

const props = defineProps({
  google: { type: Object, required: true },
  // False when the server cannot run Google rank checks (no SerpAPI key).
  available: { type: Boolean, default: true },
})

const aiOverview = computed(() => props.google.ai_overview || {})

function shortUrl(url) {
  try {
    const u = new URL(url)
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}
</script>

<style scoped>
.gc {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.gc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gc-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
}

.gc-g {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--gap-google);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.gc-when {
  color: var(--muted-foreground);
  font-size: 12px;
}

.gc-rank {
  display: grid;
  gap: 2px;
}

.gc-rank-value {
  color: var(--foreground);
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

.gc-rank-none {
  font-size: 26px;
  letter-spacing: -0.02em;
}

.gc-rank-meta,
.gc-line {
  color: var(--muted-foreground);
  font-size: 13px;
}

.gc-url {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  word-break: break-all;
}

.gc-ext {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.gc-block {
  display: grid;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
}

.gc-sub {
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.gc-results {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gc-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 6px;
  border-radius: 8px;
  font-size: 13px;
}

.gc-result.is-you {
  background: color-mix(in srgb, var(--gap-google) 10%, transparent);
}

.gc-pos {
  width: 18px;
  color: var(--muted-foreground);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.gc-domain {
  overflow: hidden;
  color: var(--foreground);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gc-tag {
  margin-left: auto;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 600;
}

.gc-tag-you {
  border-color: transparent;
  background: var(--gap-google);
  color: #ffffff;
}

.gc-gsc {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0;
}

.gc-gsc dt {
  color: var(--muted-foreground);
  font-size: 12px;
}

.gc-gsc dd {
  margin: 0;
  color: var(--foreground);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.gc-link {
  color: var(--foreground);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
