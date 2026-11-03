<script setup>
// The review of one draft (p2_contract.md 13): where it stands, the actions
// the server allows this user (`can`), the history with its comments, and
// a reminder that approving publishes nothing. Opened from ReviewChip.
import { computed, onMounted, ref } from 'vue'
import { CircleAlert } from '@lucide/vue'
import { useAgentStore } from '@/stores/agent'
import { useToast } from '@/composables/useToast'
import { useArtifactReview } from '@/composables/agent/useArtifactReview'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { PANEL_FOOTER, SOLE_WRITER_LINE, actionToast, statusLine } from '@/lib/agent/review'
import ReviewTimeline from './ReviewTimeline.vue'
import ReviewerSelect from './ReviewerSelect.vue'

const NOTE_MAX = 4000

const props = defineProps({
  websiteId: { type: String, required: true },
  artifactId: { type: String, required: true },
  // Fill the container (the drawer on phones) instead of a popover's width.
  fluid: { type: Boolean, default: false },
})

const emit = defineEmits(['changed'])

const agent = useAgentStore()
const toast = useToast()

const r = useArtifactReview(
  () => props.websiteId,
  () => props.artifactId,
  {
    onChange: (summary) => {
      if (typeof agent.setArtifactReview === 'function') agent.setArtifactReview(props.artifactId, summary)
      if (typeof agent.loadReviewsWaiting === 'function') Promise.resolve(agent.loadReviewsWaiting()).catch(() => {})
      emit('changed', summary)
    },
  },
)

// 'request' | 'changes' | ''
const mode = ref('')
const changesNote = ref('')
const changesError = ref('')
const commentText = ref('')

const review = computed(() => r.review.value)
const can = computed(() => review.value?.can || {})
const line = computed(() => statusLine(review.value))
const busy = computed(() => r.busy.value)

onMounted(() => {
  r.reload()
})

function openRequest() {
  mode.value = 'request'
  if (r.teamState.value === 'idle' || r.teamState.value === 'error') r.loadTeam()
}

async function sendRequest({ reviewer_id, reviewer_name, note }) {
  if (await r.act('request', { reviewer_id, note })) {
    mode.value = ''
    toast.success(actionToast('request', { reviewerName: reviewer_name }))
  }
}

async function run(action) {
  if (await r.act(action)) toast.success(actionToast(action))
}

async function sendChanges() {
  const note = changesNote.value.trim()
  if (!note) {
    changesError.value = 'Say what should change.'
    return
  }
  changesError.value = ''
  if (await r.act('request_changes', { note })) {
    mode.value = ''
    changesNote.value = ''
    toast.success(actionToast('request_changes'))
  }
}

async function sendComment() {
  if (await r.comment(commentText.value)) {
    commentText.value = ''
    toast.success(actionToast('comment'))
  }
}
</script>

<template>
  <div class="ag-rp" :class="{ 'is-fluid': fluid }">
    <h2 class="ag-rp-title">Review</h2>

    <div v-if="r.loading.value && !review" class="ag-rp-state" role="status">
      <AgSpinner :size="12" />
      <span>Loading the review</span>
    </div>
    <p v-else-if="!review && r.error.value" class="ag-rp-error" role="alert">
      <CircleAlert :size="14" aria-hidden="true" />
      <span>{{ r.error.value }}</span>
    </p>

    <template v-else-if="review">
      <p class="ag-rp-status" aria-live="polite">{{ line }}</p>
      <p v-if="review.sole_writer && can.approve" class="ag-rp-sole">{{ SOLE_WRITER_LINE }}</p>

      <ReviewerSelect
        v-if="mode === 'request'"
        :team="r.team.value"
        :loading="r.teamState.value === 'loading'"
        :busy="busy === 'request'"
        @send="sendRequest"
        @cancel="mode = ''"
      />

      <form v-else-if="mode === 'changes'" class="ag-rp-changes" novalidate @submit.prevent="sendChanges">
        <label class="ag-rp-label" for="ag-rp-changes-note">Request changes</label>
        <textarea
          id="ag-rp-changes-note"
          v-model="changesNote"
          class="ag-rp-input"
          rows="3"
          :maxlength="NOTE_MAX"
          placeholder="What should change?"
          :aria-invalid="changesError ? 'true' : undefined"
        />
        <p v-if="changesError" class="ag-rp-error" role="alert">{{ changesError }}</p>
        <div class="ag-rp-row">
          <AgButton size="xs" variant="ghost" :disabled="busy === 'request_changes'" @click="mode = ''">Cancel</AgButton>
          <AgButton type="submit" size="xs" variant="primary" :loading="busy === 'request_changes'">Send</AgButton>
        </div>
      </form>

      <div v-else class="ag-rp-actions">
        <AgButton v-if="can.request" size="xs" variant="primary" :disabled="Boolean(busy)" @click="openRequest">
          Request review
        </AgButton>
        <AgButton v-if="can.approve" size="xs" variant="primary" :loading="busy === 'approve'" :disabled="Boolean(busy)" @click="run('approve')">
          Approve
        </AgButton>
        <AgButton v-if="can.request_changes" size="xs" :disabled="Boolean(busy)" @click="mode = 'changes'">
          Request changes
        </AgButton>
        <AgButton v-if="can.withdraw" size="xs" variant="ghost" :loading="busy === 'withdraw'" :disabled="Boolean(busy)" @click="run('withdraw')">
          Withdraw request
        </AgButton>
        <AgButton v-if="can.reopen" size="xs" variant="ghost" :loading="busy === 'reopen'" :disabled="Boolean(busy)" @click="run('reopen')">
          Reopen
        </AgButton>
      </div>

      <p v-if="r.error.value" class="ag-rp-error" role="alert">
        <CircleAlert :size="14" aria-hidden="true" />
        <span>{{ r.error.value }}</span>
      </p>

      <ReviewTimeline :events="review.events || []" />

      <form v-if="can.comment" class="ag-rp-comment" novalidate @submit.prevent="sendComment">
        <label class="ag-rp-label" for="ag-rp-comment">Add a comment</label>
        <textarea id="ag-rp-comment" v-model="commentText" class="ag-rp-input" rows="2" :maxlength="NOTE_MAX" />
        <div class="ag-rp-row">
          <AgButton type="submit" size="xs" :loading="busy === 'comment'" :disabled="!commentText.trim() || Boolean(busy)">
            Comment
          </AgButton>
        </div>
      </form>
    </template>

    <p class="ag-rp-foot">{{ PANEL_FOOTER }}</p>
  </div>
</template>

<style scoped>
.ag-rp {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: min(380px, calc(100vw - 32px));
  max-height: min(560px, calc(100dvh - 96px));
  padding: 16px;
  overflow-y: auto;
}

.ag-rp.is-fluid {
  width: 100%;
  max-height: none;
}

.ag-rp-title {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.ag-rp-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ag-fg-3);
  font-size: 13px;
}

.ag-rp-status {
  margin: 0;
  color: var(--ag-fg-1);
  font-size: 13.5px;
  line-height: 20px;
}

.ag-rp-sole {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
  line-height: 19px;
}

.ag-rp-actions,
.ag-rp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ag-rp-row {
  justify-content: flex-end;
}

.ag-rp-changes,
.ag-rp-comment {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ag-rp-label {
  color: var(--ag-fg-1);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 18px;
}

.ag-rp-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: 6px 10px;
  border: 1px solid var(--ag-composer-border);
  border-radius: 8px;
  background: var(--ag-composer-bg);
  color: var(--ag-fg-1);
  font: inherit;
  font-size: 13.5px;
  line-height: 20px;
  outline: none;
  resize: vertical;
}

.ag-rp-input:focus-visible {
  border-color: var(--ag-ring);
  border-radius: 8px;
  outline: none;
}

.ag-rp-input[aria-invalid='true'] {
  border-color: var(--ag-danger);
}

.ag-rp-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--ag-danger);
  font-size: 13px;
  line-height: 18px;
}

.ag-rp-foot {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--ag-divider-subtle);
  color: var(--ag-fg-3);
  font-size: 12px;
  line-height: 17px;
}

@media (pointer: coarse) {
  .ag-rp-input {
    font-size: 16px;
  }
}
</style>
