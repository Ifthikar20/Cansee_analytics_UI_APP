<script setup>
// A Social Posts Agent draft (p2_contract.md 12d social_posts, 12f): posts
// grouped by network, each part with the server's count against the
// network's limit. The client never counts characters itself: X weighs
// links and some characters differently, and only the server's count is
// the one the limit refers to.
import { computed } from 'vue'
import { ExternalLink, TriangleAlert } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/agent/download'
import { postCopyText, socialPosts } from '@/lib/agent/structured'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  data: { type: Object, default: null },
  live: { type: Boolean, default: false },
})

const toast = useToast()
const count = new Intl.NumberFormat('en-US')

const view = computed(() => socialPosts(props.data))
const drafting = computed(() => props.live || view.value.drafting)
const hasX = computed(() => view.value.posts.some((p) => p.channel === 'x' || p.channel === 'x_thread'))

function counter(part) {
  if (part.length === null || part.limit === null) return { text: 'Counted when the draft is saved.', over: false }
  const text = `${count.format(part.length)} / ${count.format(part.limit)}`
  return part.over ? { text: `${text}, over the limit`, over: true } : { text, over: false }
}

async function copyPost(post) {
  if (await copyText(postCopyText(post))) toast.success('Copied')
}
</script>

<template>
  <div class="ag-spv">
    <section v-for="group in view.groups" :key="group.key" class="ag-spv-group" :aria-labelledby="`ag-spv-${group.key}`">
      <h3 :id="`ag-spv-${group.key}`" class="ag-spv-title">{{ group.label }}</h3>
      <article v-for="post in group.posts" :key="post.id" class="ag-spv-post">
        <ol class="ag-spv-parts" :class="{ 'is-thread': post.parts.length > 1 }">
          <li v-for="(part, i) in post.parts" :key="i" class="ag-spv-part">
            <p class="ag-spv-text">{{ part.text }}</p>
            <p class="ag-spv-count ag-tnum" :class="{ 'is-over': counter(part).over }">
              <TriangleAlert v-if="counter(part).over" :size="13" aria-hidden="true" />
              {{ counter(part).text }}
            </p>
          </li>
        </ol>
        <div class="ag-spv-foot">
          <a
            v-if="safeHref(post.link_url)"
            :href="safeHref(post.link_url)"
            class="ag-spv-link"
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {{ post.link_url }}
            <ExternalLink :size="11" aria-hidden="true" />
          </a>
          <AgButton v-if="!drafting" size="xs" variant="ghost" class="ag-spv-copy" @click="copyPost(post)">Copy</AgButton>
        </div>
      </article>
    </section>

    <p v-if="hasX" class="ag-spv-note">X counts each link as 23 characters and some characters as two.</p>
    <p v-if="drafting" class="ag-spv-drafting" role="status"><AgSpinner :size="12" /> Drafting…</p>
  </div>
</template>

<style scoped>
.ag-spv {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 32px;
  color: var(--ag-fg-1);
}

.ag-spv-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ag-spv-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.ag-spv-post {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--ag-card-border);
  border-radius: var(--radius);
}

.ag-spv-parts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-spv-parts.is-thread {
  padding-left: 18px;
  list-style: decimal;
}

.ag-spv-part {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ag-spv-text {
  margin: 0;
  font-size: 14px;
  line-height: 21px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ag-spv-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 16px;
}

.ag-spv-count.is-over {
  color: var(--ag-warning);
}

.ag-spv-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ag-spv-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  color: var(--ag-fg-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-spv-foot :deep(.ag-spv-copy) {
  margin-left: auto;
}

.ag-spv-note,
.ag-spv-drafting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 12.5px;
  line-height: 18px;
}

@media (max-width: 560px) {
  .ag-spv {
    padding: 16px;
  }
}
</style>
