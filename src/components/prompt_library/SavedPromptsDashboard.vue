<template>
  <div class="spd">
    <!-- Toolbar: search + status + topic + grouping + actions -->
    <div class="spd-toolbar">
      <div class="spd-toolbar-left">
        <div class="spd-search-wrap">
          <Search :size="15" :stroke-width="2" />
          <input v-model="search" type="search" placeholder="Search prompts…" class="spd-search" />
        </div>
        <div class="spd-segmented" role="tablist">
          <button
            type="button"
            class="spd-seg-btn"
            :class="{ 'is-on': status === 'active' }"
            @click="status = 'active'"
          >Active</button>
          <button
            type="button"
            class="spd-seg-btn"
            :class="{ 'is-on': status === 'archived' }"
            @click="status = 'archived'"
          >Archived</button>
        </div>
      </div>

      <div class="spd-toolbar-right">
        <label class="spd-field">
          <Folder :size="14" :stroke-width="1.8" />
          <select v-model="activeTopic" class="spd-select" aria-label="Filter by group">
            <option value="">All groups ({{ rows.length }})</option>
            <option v-for="t in topics" :key="t.name" :value="t.name">{{ t.name }} ({{ t.count }})</option>
          </select>
        </label>
        <label class="spd-field">
          <Layers :size="14" :stroke-width="1.8" />
          <select v-model="groupBy" class="spd-select" aria-label="Group prompts by">
            <option value="none">Default prompts</option>
            <option value="topic">By group</option>
            <option value="tag">By tag</option>
            <option value="status">By status</option>
          </select>
        </label>
        <!-- Column visibility. Click-outside closes it; the backdrop sits
             behind the panel so it cannot swallow the checkbox clicks. -->
        <div class="spd-colmenu-wrap">
          <button
            type="button"
            class="spd-icon-btn"
            :class="{ 'is-on': showColumnMenu }"
            aria-label="Choose columns"
            title="Choose columns"
            @click="showColumnMenu = !showColumnMenu"
          >
            <Columns3 :size="15" :stroke-width="2" />
          </button>
          <template v-if="showColumnMenu">
            <div class="spd-colmenu-backdrop" @click="showColumnMenu = false"></div>
            <div class="spd-colmenu">
              <p class="spd-colmenu-head">Fixed</p>
              <label v-for="col in fixedColumns" :key="col.key" class="spd-colmenu-row is-fixed">
                <input type="checkbox" checked disabled />
                <span>{{ col.label }}</span>
              </label>

              <p class="spd-colmenu-head">Visible</p>
              <label v-for="col in shownColumns" :key="col.key" class="spd-colmenu-row">
                <input type="checkbox" checked @change="toggleColumn(col.key)" />
                <span>{{ col.label }}</span>
              </label>

              <template v-if="hiddenColumns.length">
                <p class="spd-colmenu-head">Hidden</p>
                <label v-for="col in hiddenColumns" :key="col.key" class="spd-colmenu-row">
                  <input type="checkbox" @change="toggleColumn(col.key)" />
                  <span>{{ col.label }}</span>
                </label>
              </template>

              <div class="spd-colmenu-foot">
                <button type="button" class="spd-colmenu-reset" @click="resetColumns">Reset</button>
                <button type="button" class="spd-btn spd-btn-primary" @click="showColumnMenu = false">Done</button>
              </div>
            </div>
          </template>
        </div>
        <button
          type="button"
          class="spd-icon-btn"
          :disabled="!sorted.length"
          aria-label="Export as CSV"
          :title="`Export ${sorted.length} rows as CSV`"
          @click="exportCsv"
        >
          <Download :size="15" :stroke-width="2" />
        </button>
        <button type="button" class="spd-btn spd-btn-neon" @click="showHelpCreate = true">
          <Sparkles :size="14" :stroke-width="2" />
          Help me create prompts
        </button>
        <button type="button" class="spd-btn spd-btn-primary" @click="openAddPrompt">
          <Plus :size="14" :stroke-width="2.2" />
          Add Prompt
        </button>
      </div>
    </div>

    <!-- Tag filter row -->
    <div v-if="allTags.length" class="spd-tagfilter">
      <span class="spd-tagfilter-label"><Tag :size="13" :stroke-width="1.8" /> Tags</span>
      <button
        v-for="tag in allTags"
        :key="tag"
        type="button"
        class="spd-tag spd-tag-btn"
        :class="[`is-${tagClass(tag)}`, { 'is-selected': selectedTags.has(tag) }]"
        @click="toggleTagFilter(tag)"
      >{{ tag }}</button>
      <button v-if="selectedTags.size" type="button" class="spd-tag-clear" @click="clearTagFilter">
        <X :size="12" :stroke-width="2.2" /> Clear
      </button>
    </div>

    <!-- Portfolio KPIs. The endpoint has always returned these; the table
         just never read them. Averages are across every saved prompt, so
         they stay put while you filter -- a fixed reference to compare the
         rows below against. -->
    <div v-if="!loading && kpi && rows.length" class="spd-kpis">
      <div class="spd-kpi">
        <span class="spd-kpi-label">Avg visibility</span>
        <span class="spd-kpi-val">{{ kpi.visibility_pct ?? 0 }}%</span>
      </div>
      <div class="spd-kpi">
        <span class="spd-kpi-label">Avg sentiment</span>
        <span class="spd-kpi-val">
          <template v-if="kpi.sentiment_score != null">
            <span class="spd-sent-dot" :class="sentimentClass(kpi.sentiment_score)"></span>{{ kpi.sentiment_score }}
          </template>
          <span v-else class="spd-mute">—</span>
        </span>
      </div>
      <div class="spd-kpi">
        <span class="spd-kpi-label">Avg position</span>
        <span class="spd-kpi-val">
          <template v-if="kpi.avg_position != null">#{{ kpi.avg_position }}</template>
          <span v-else class="spd-mute">—</span>
        </span>
      </div>
      <div class="spd-kpi">
        <span class="spd-kpi-label">Never run</span>
        <span class="spd-kpi-val">{{ neverRunCount }}</span>
      </div>
    </div>

    <!-- Prompt count -->
    <div class="spd-countline">{{ sorted.length }} {{ sorted.length === 1 ? 'prompt' : 'prompts' }}</div>

    <!-- Bulk action bar -->
    <div v-if="selectedIds.size" class="spd-bulkbar">
      <span class="spd-bulk-count">{{ selectedIds.size }} selected</span>
      <div class="spd-bulk-actions">
        <button v-if="status === 'active'" type="button" class="spd-bulk-btn" :disabled="bulkPending" @click="bulkSetActive(false)">
          <Archive :size="14" :stroke-width="2" /> Archive
        </button>
        <button v-else type="button" class="spd-bulk-btn" :disabled="bulkPending" @click="bulkSetActive(true)">
          <ArchiveRestore :size="14" :stroke-width="2" /> Unarchive
        </button>
        <button type="button" class="spd-bulk-btn spd-bulk-danger" :disabled="bulkPending" @click="bulkDelete">
          <Trash2 :size="14" :stroke-width="2" /> Delete
        </button>
        <button type="button" class="spd-bulk-btn spd-bulk-ghost" @click="selectedIds = new Set()">Clear</button>
      </div>
    </div>

    <!-- Table -->
    <div class="spd-table-wrap">
      <div v-if="loading" class="spd-empty">
        <div class="spd-spinner" aria-hidden="true"></div>
        <p>Loading saved prompts…</p>
      </div>

      <div v-else-if="!sorted.length" class="spd-empty">
        <Inbox :size="36" :stroke-width="1.5" />
        <h3 v-if="hasActiveFilters">No prompts match these filters</h3>
        <h3 v-else-if="status === 'archived'">No archived prompts</h3>
        <h3 v-else>No prompts yet</h3>
        <p v-if="hasActiveFilters">Try clearing the topic, tag, or search filters.</p>
        <p v-else>Start with 10 ready-made prompts for your domain, or add your own.</p>
        <button v-if="hasActiveFilters" class="spd-btn spd-btn-primary spd-add-empty" @click="resetFilters">Clear filters</button>
        <div v-else class="spd-empty-actions">
          <button class="spd-btn spd-btn-neon spd-add-empty" @click="showHelpCreate = true">
            <Sparkles :size="14" :stroke-width="2" /> Generate 10 sample prompts
          </button>
          <button class="spd-btn spd-btn-primary spd-add-empty" @click="openAddPrompt">
            <Plus :size="14" :stroke-width="2.2" /> Add your first prompt
          </button>
        </div>
      </div>

      <Table v-else class="spd-table">
        <TableHeader>
          <TableRow>
            <TableHead class="spd-th-check">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            </TableHead>
            <TableHead
              v-for="col in visibleColumns"
              :key="col.key"
              :class="[
                col.num ? 'num' : '',
                col.sort ? 'spd-th-sort' : '',
                col.key === 'prompt' ? 'spd-th-prompt' : '',
                sortKey === col.key ? 'is-sorted' : '',
              ]"
              @click="setSort(col.key)"
            >
              <span class="spd-th-with-icon">
                {{ col.label }}
                <component v-if="col.sort" :is="sortIcon(col.key)" :size="12" :stroke-width="2" />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="group in groups" :key="group.key">
            <TableRow v-if="groupBy !== 'none'" class="spd-group-row">
              <TableCell :colspan="colspan" class="spd-group-head">
                {{ group.label }} <span class="spd-group-count">{{ group.rows.length }}</span>
              </TableCell>
            </TableRow>
            <TableRow v-for="row in group.rows" :key="row.brand_prompt_id" @click="openDetail(row)">
              <TableCell @click.stop>
                <input type="checkbox" :checked="selectedIds.has(row.brand_prompt_id)" @change="toggleRow(row)" />
              </TableCell>
              <!-- One loop over the same registry the header uses, so column
                   order can never drift between the two. -->
              <TableCell
                v-for="col in visibleColumns"
                :key="col.key"
                :class="[
                  col.num ? 'num' : '',
                  col.key === 'prompt' ? 'spd-td-prompt' : '',
                  col.key === 'origin' ? 'spd-loc' : '',
                  col.key === 'last_run' || col.key === 'next_run' ? 'spd-runcell' : '',
                ]"
                @click="col.key === 'tags' ? $event.stopPropagation() : null"
              >
                <template v-if="col.key === 'prompt'">{{ row.text }}</template>

                <!-- Visibility reads as a share, so it gets a bar behind the
                     number rather than a bare percentage. -->
                <template v-else-if="col.key === 'visibility'">
                  <span class="spd-vis-wrap" :title="`${row.total_mentions} of ${row.responses_seen} responses`">
                    <span class="spd-vis">{{ row.visibility_pct }}%</span>
                    <span class="spd-vis-track">
                      <span class="spd-vis-fill" :style="{ width: Math.min(100, row.visibility_pct) + '%' }"></span>
                    </span>
                  </span>
                </template>

                <template v-else-if="col.key === 'mentions'">
                  <span v-if="row.responses_seen" class="spd-frac">
                    {{ row.total_mentions }}<span class="spd-frac-sep">/</span><span class="spd-frac-den">{{ row.responses_seen }}</span>
                  </span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'sentiment'">
                  <span v-if="row.sentiment_score != null" :title="sentimentTitle(row)">
                    <span class="spd-sent-dot" :class="sentimentClass(row.sentiment_score)"></span>
                    {{ row.sentiment_score }}
                  </span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'position'">
                  <span v-if="row.avg_position != null" class="spd-pos"># {{ row.avg_position }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'engines'">
                  <div class="spd-mentions">
                    <span
                      v-for="(p, i) in (row.models_mentioned || []).slice(0, 3)"
                      :key="p"
                      class="spd-mention-dot"
                      :class="`is-${p}`"
                      :title="engineTitle(row, p)"
                      :style="{ zIndex: 5 - i }"
                    ></span>
                    <span v-if="(row.models_mentioned || []).length > 3" class="spd-mention-more">+{{ row.models_mentioned.length - 3 }}</span>
                    <span v-if="!(row.models_mentioned || []).length" class="spd-mute"><CloudOff :size="14" :stroke-width="1.8" /></span>
                  </div>
                </template>

                <!-- Who else the models name here. The top two by name, then
                     an overflow count -- enough to recognise the shape of the
                     competition without the cell becoming a paragraph. -->
                <template v-else-if="col.key === 'competitors'">
                  <div v-if="(row.top_competitors || []).length" class="spd-comps" :title="competitorTitle(row)">
                    <span
                      v-for="c in row.top_competitors.slice(0, 2)"
                      :key="c.name"
                      class="spd-comp"
                    >{{ c.name }}</span>
                    <span v-if="row.competitors_count > 2" class="spd-comp-more">+{{ row.competitors_count - 2 }}</span>
                  </div>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'citations'">
                  <span v-if="row.citations_count" :title="domainTitle(row)">{{ row.citations_count }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'volume'">
                  <span class="spd-volume" :title="`Demand ${row.demand_score}`">
                    <span v-for="i in 4" :key="i" class="spd-vol-bar" :class="{ 'is-on': demandBars(row.demand_score) >= i }"></span>
                  </span>
                </template>

                <template v-else-if="col.key === 'tags'">
                  <template v-if="(row.tags || []).length">
                    <button
                      v-for="t in row.tags"
                      :key="t"
                      type="button"
                      class="spd-tag spd-tag-btn"
                      :class="[`is-${tagClass(t)}`, { 'is-selected': selectedTags.has(t) }]"
                      :title="`Filter by ${t}`"
                      @click="toggleTagFilter(t)"
                    >{{ t }}</button>
                  </template>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'origin'">
                  <template v-if="row.location">
                    <span aria-hidden="true">{{ flag(row.location) }}</span> {{ countryName(row.location) }}
                  </template>
                  <span v-else class="spd-mute">🌐 Global</span>
                </template>

                <template v-else-if="col.key === 'last_run'">
                  <span v-if="row.last_run_at" :title="fullDate(row.last_run_at)">{{ shortDate(row.last_run_at) }}</span>
                  <span v-else class="spd-mute">Never</span>
                </template>

                <template v-else-if="col.key === 'next_run'">
                  <template v-if="row.next_run_at">
                    <span class="spd-next" :title="fullDate(row.next_run_at)">{{ shortDate(row.next_run_at) }}</span>
                    <span v-if="row.schedule_frequency" class="spd-freq">{{ row.schedule_frequency }}</span>
                  </template>
                  <span v-else class="spd-mute">Not scheduled</span>
                </template>

                <template v-else-if="col.key === 'intent'">
                  <span v-if="row.intent_bucket" class="spd-pill">{{ row.intent_bucket }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'topic'">
                  <span v-if="row.topic">{{ row.topic }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'effectiveness'">
                  <span v-if="row.effectiveness_score != null">{{ Math.round(row.effectiveness_score * 100) }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'runs'">
                  <span v-if="row.runs_count">{{ row.runs_count }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>

                <template v-else-if="col.key === 'top_domain'">
                  <span v-if="(row.top_domains || []).length" :title="domainTitle(row)">{{ row.top_domains[0].domain }}</span>
                  <span v-else class="spd-mute">—</span>
                </template>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>

      <div v-if="sorted.length" class="spd-pager">
        <span class="spd-pager-range">
          Viewing {{ rangeStart }}-{{ rangeEnd }} of {{ sorted.length }}
        </span>
        <div class="spd-pager-controls">
          <label class="spd-field spd-pager-size">
            <select v-model.number="pageSize" class="spd-select" aria-label="Rows per page">
              <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }} / page</option>
              <option :value="0">All</option>
            </select>
          </label>
          <button
            type="button"
            class="spd-pager-btn"
            :disabled="page <= 1"
            aria-label="Previous page"
            @click="goPage(page - 1)"
          ><ChevronLeft :size="15" :stroke-width="2" /></button>
          <span class="spd-pager-page">{{ page }} / {{ pageCount }}</span>
          <button
            type="button"
            class="spd-pager-btn"
            :disabled="page >= pageCount"
            aria-label="Next page"
            @click="goPage(page + 1)"
          ><ChevronRight :size="15" :stroke-width="2" /></button>
        </div>
      </div>
    </div>

    <!-- Add prompt / bulk upload modal -->
    <div
      v-if="showAdd"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showAdd = false"
    >
      <div class="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <!-- tab switch -->
        <div class="mb-5 flex rounded-xl bg-secondary p-1">
          <button
            type="button"
            class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors"
            :class="addTab === 'add' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            @click="addTab = 'add'"
          >Add Prompt</button>
          <button
            type="button"
            class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors"
            :class="addTab === 'bulk' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            @click="addTab = 'bulk'"
          >Bulk Upload</button>
          <button
            type="button"
            class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors"
            :class="addTab === 'models' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            @click="addTab = 'models'"
          >
            Models
            <span class="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{{ addModels.length }}</span>
          </button>
        </div>

        <!-- ADD PROMPT -->
        <template v-if="addTab === 'add'">
          <h3 class="text-base font-semibold text-foreground">Add Prompt</h3>
          <p class="mb-4 text-sm text-muted-foreground">Add your own prompts. Every line becomes a separate prompt.</p>

          <div class="mb-1 flex items-center justify-between">
            <label class="text-xs font-medium text-muted-foreground">Prompt</label>
            <span class="text-xs text-muted-foreground">{{ promptCount }} prompt{{ promptCount === 1 ? '' : 's' }}</span>
          </div>
          <textarea
            v-model="addText"
            rows="3"
            placeholder="e.g. any alternative to rocket money"
            class="mb-4 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>

          <label class="mb-1 block text-xs font-medium text-muted-foreground">Group</label>
          <input
            v-model="addTopic"
            list="spd-topic-options"
            placeholder="Default prompts — pick or type a group"
            class="mb-1 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p class="mb-4 text-xs text-muted-foreground">Leave empty to file under <strong>Default prompts</strong>.</p>
          <datalist id="spd-topic-options">
            <option v-for="t in topics" :key="t.name" :value="t.name" />
          </datalist>

          <label class="mb-1 block text-xs font-medium text-muted-foreground">Origin</label>
          <select
            v-model="addLocation"
            class="mb-4 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option v-for="l in LOCATIONS" :key="l.code" :value="l.code">{{ l.name }}</option>
          </select>

          <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Tags</label>
          <div class="mb-5 flex flex-wrap gap-2">
            <button
              v-for="tag in TAG_PRESETS"
              :key="tag"
              type="button"
              class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              :class="addTags.includes(tag)
                ? 'border-ring bg-secondary text-foreground'
                : 'border-border text-muted-foreground hover:border-ring'"
              @click="toggleTag(tag)"
            >{{ tag }}</button>
          </div>

          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary" @click="showAdd = false">Cancel</button>
            <button
              type="button"
              class="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              :disabled="addPending"
              @click="submitAdd"
            >{{ addPending ? 'Adding…' : 'Add Prompt' }}</button>
          </div>
        </template>

        <!-- MODELS -->
        <template v-else-if="addTab === 'models'">
          <h3 class="text-base font-semibold text-foreground">Models to test</h3>
          <p class="mb-4 text-sm text-muted-foreground">
            Pick the exact models these prompts are measured against — several
            versions of the same provider is fine. Applies to every prompt
            added in this dialog.
          </p>

          <div class="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
            <div v-for="group in variantGroups" :key="group.provider">
              <div class="mb-1.5 flex items-baseline justify-between">
                <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ group.label }}</span>
                <span v-if="!group.configured" class="text-[10px] text-muted-foreground">API key not configured</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="v in group.variants"
                  :key="v.id"
                  type="button"
                  :disabled="!v.configured"
                  :title="v.model_id + (v.configured ? '' : ' — API key not configured')"
                  class="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  :class="addModels.includes(v.id)
                    ? 'border-ring bg-secondary text-foreground'
                    : 'border-border text-muted-foreground hover:border-ring'"
                  @click="toggleModel(v.id)"
                >
                  {{ v.label }}<span v-if="v.is_default" class="ml-1 text-[10px] text-muted-foreground">default</span>
                </button>
              </div>
            </div>
            <p v-if="!variantGroups.length" class="text-sm text-muted-foreground">Loading model catalog…</p>
          </div>

          <p class="mt-3 text-xs text-muted-foreground">
            {{ addModels.length }} selected · each model answers every prompt on each scan.
          </p>

          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary" @click="addTab = 'add'">Back</button>
            <button
              type="button"
              class="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              :disabled="addPending"
              @click="submitAdd"
            >{{ addPending ? 'Adding…' : 'Add Prompt' }}</button>
          </div>
        </template>

        <!-- BULK UPLOAD -->
        <template v-else>
          <p class="mb-3 text-center text-sm text-muted-foreground">
            Make sure your CSV follows the required format or
            <button type="button" class="underline hover:text-foreground" @click="downloadCsvExample">download example</button>.
          </p>
          <label
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center hover:border-ring"
            @dragover.prevent
            @drop.prevent="onCsvFile"
          >
            <Plus :size="22" :stroke-width="1.8" class="text-muted-foreground" />
            <span class="text-sm text-foreground">Drag and drop your file here, or <span class="underline">click to browse</span></span>
            <input type="file" accept=".csv,text/csv" class="hidden" @change="onCsvFile" />
          </label>
          <div class="mt-5 flex justify-end">
            <button type="button" class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary" @click="showAdd = false">Cancel</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Help me create prompts: seed the list with a diverse starter set -->
    <div
      v-if="showHelpCreate"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="!helpGenerating && (showHelpCreate = false)"
    >
      <div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
          <Sparkles :size="20" :stroke-width="2" class="text-foreground" />
        </div>
        <h3 class="text-base font-semibold text-foreground">Help me create prompts</h3>
        <p class="mx-auto mb-4 mt-1 max-w-sm text-sm text-muted-foreground">
          We'll add <strong>10 ready-made prompts</strong> for
          <strong>{{ appStore.activeWebsite?.name || 'your project' }}</strong> across
          very different buyer intents — recommendations, comparisons,
          alternatives, reviews, use cases and more. No tracking pixel or
          integration needed; you can edit or archive any of them, and your
          first scan measures how often AI answers mention you.
        </p>
        <p v-if="helpError" class="mx-auto mb-3 max-w-sm rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ helpError }}
        </p>
        <div class="flex justify-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
            :disabled="helpGenerating"
            @click="showHelpCreate = false"
          >Cancel</button>
          <button
            type="button"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            :disabled="helpGenerating"
            @click="generateSamples"
          >{{ helpGenerating ? 'Generating…' : 'Generate 10 prompts' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import llmRankingApi from '@/api/llm_ranking'
import promptLibrary from '@/api/promptLibrary'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import {
  Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsUpDown, ChevronUp, CloudOff, Columns3, Download, Folder, Inbox,
  Layers, Plus, Search, Sparkles, Tag, Trash2, X,
} from '@lucide/vue'
import { useToast } from '@/composables/useToast'

defineEmits(['go-search'])

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const toast = useToast()
const websiteId = route.params.websiteId

/* ── Data ── */
const rows = ref([])
const topics = ref([])
const allTags = ref([])
const kpi = ref(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const { data } = await promptLibrary.savedPromptsAgg(websiteId)
    const body = data || {}
    rows.value = body.rows || []
    topics.value = body.topics || []
    kpi.value = body.kpi || null
    // Prefer the server's distinct tag list; fall back to deriving from rows.
    // The agg endpoint returns all_tags as {name, count} objects, while
    // row.tags are plain strings — normalize to strings so filtering matches.
    const rawTags = (body.all_tags && body.all_tags.length)
      ? body.all_tags.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      : (body.rows || []).flatMap((r) => r.tags || [])
    allTags.value = [...new Set(rawTags)]
  } catch (_) {
    rows.value = []
    topics.value = []
    allTags.value = []
    kpi.value = null
  } finally {
    loading.value = false
  }
}
onMounted(() => { load(); loadRegions(); loadModelVariants() })
defineExpose({ load, get count() { return rows.value.length } })

/* ── Filters / sort / group state ── */
const status = ref('active')          // 'active' | 'archived'
const activeTopic = ref('')
const selectedTags = ref(new Set())
const search = ref('')
const groupBy = ref('none')           // 'none' | 'topic' | 'tag' | 'status'
const sortKey = ref('visibility')     // visibility | sentiment | position | volume | none
const sortDir = ref('desc')           // 'asc' | 'desc'

const hasActiveFilters = computed(() =>
  !!activeTopic.value || selectedTags.value.size > 0 || !!search.value.trim())

function resetFilters() {
  activeTopic.value = ''
  selectedTags.value = new Set()
  search.value = ''
}

function toggleTagFilter(tag) {
  const next = new Set(selectedTags.value)
  if (next.has(tag)) next.delete(tag); else next.add(tag)
  selectedTags.value = next
}
function clearTagFilter() { selectedTags.value = new Set() }

const filtered = computed(() => {
  let list = rows.value.filter((r) => (status.value === 'archived' ? r.is_archived : !r.is_archived))
  if (activeTopic.value) list = list.filter((r) => r.topic === activeTopic.value)
  if (selectedTags.value.size) {
    // A prompt matches if it carries every selected tag (AND semantics).
    list = list.filter((r) => [...selectedTags.value].every((t) => (r.tags || []).includes(t)))
  }
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((r) => (r.text || '').toLowerCase().includes(q))
  return list
})

/* ── Columns ──
 * One registry drives the header, the body cells, the visibility menu and
 * the CSV export, so those four can never drift out of sync.
 *
 *   sort   accessor for sorting; omit to make the column unsortable
 *   asc    true when a LOWER value is better, so the first click sorts up
 *   csv    value for the export; falls back to `sort`
 *   num    right-aligned + tabular figures
 *   on     shown by default; the rest start in the "hidden" group.
 *          Order here is display order, so an off-by-default column is
 *          declared next to the one it relates to, not appended.
 */
const COLUMNS = [
  { key: 'prompt', label: 'Prompt', on: true, fixed: true,
    csv: (r) => r.text },
  { key: 'intent', label: 'Intent',
    sort: (r) => r.intent_bucket || '',
    csv: (r) => r.intent_bucket || '' },
  { key: 'topic', label: 'Group',
    sort: (r) => r.topic || '',
    csv: (r) => r.topic || '' },
  { key: 'visibility', label: 'Visibility', on: true, num: true,
    sort: (r) => r.visibility_pct },
  { key: 'mentions', label: 'Mentions', on: true, num: true,
    sort: (r) => r.total_mentions,
    csv: (r) => `${r.total_mentions}/${r.responses_seen}` },
  { key: 'sentiment', label: 'Sentiment', on: true, num: true,
    sort: (r) => r.sentiment_score },
  { key: 'position', label: 'Position', on: true, num: true, asc: true,
    sort: (r) => r.avg_position },
  { key: 'engines', label: 'Engines', on: true,
    sort: (r) => (r.models_mentioned || []).length,
    csv: (r) => (r.models_mentioned || []).join(' ') },
  { key: 'competitors', label: 'Competitors', on: true,
    sort: (r) => r.competitors_count,
    csv: (r) => (r.top_competitors || []).map((c) => c.name).join(' ') },
  { key: 'citations', label: 'Citations', on: true, num: true,
    sort: (r) => r.citations_count,
    csv: (r) => r.citations_count },
  { key: 'top_domain', label: 'Top source',
    sort: (r) => (r.top_domains || [])[0]?.domain || '',
    csv: (r) => (r.top_domains || [])[0]?.domain || '' },
  { key: 'volume', label: 'Volume', on: true,
    sort: (r) => r.demand_score },
  { key: 'effectiveness', label: 'Effectiveness', num: true,
    sort: (r) => r.effectiveness_score },
  { key: 'runs', label: 'Runs', num: true,
    sort: (r) => r.runs_count },
  { key: 'tags', label: 'Tags', on: true,
    csv: (r) => (r.tags || []).join(' ') },
  { key: 'origin', label: 'Origin', on: true, num: true,
    sort: (r) => r.location || '',
    csv: (r) => r.location || '' },
  { key: 'last_run', label: 'Last run', on: true,
    sort: (r) => (r.last_run_at ? Date.parse(r.last_run_at) : null),
    csv: (r) => r.last_run_at || '' },
  { key: 'next_run', label: 'Next run', on: true,
    sort: (r) => (r.next_run_at ? Date.parse(r.next_run_at) : null),
    csv: (r) => r.next_run_at || '' },
]

const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]))
const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.on).map((c) => c.key)
const COLUMN_STORE_KEY = 'cs_prompt_table_columns'

function loadColumnPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(COLUMN_STORE_KEY) || 'null')
    if (!Array.isArray(raw)) return DEFAULT_VISIBLE
    // Drop keys that no longer exist so a renamed column cannot strand a
    // saved preference, and never let the set go fully empty.
    const known = raw.filter((k) => COLUMN_BY_KEY[k] && !COLUMN_BY_KEY[k].fixed)
    return known.length ? known : DEFAULT_VISIBLE
  } catch {
    return DEFAULT_VISIBLE
  }
}

const visibleKeys = ref(new Set(loadColumnPrefs()))
const showColumnMenu = ref(false)

function persistColumns() {
  try {
    localStorage.setItem(COLUMN_STORE_KEY, JSON.stringify([...visibleKeys.value]))
  } catch {
    // Private mode / blocked storage: the choice just won't survive reload.
  }
}
function isVisible(key) {
  return COLUMN_BY_KEY[key]?.fixed || visibleKeys.value.has(key)
}
function toggleColumn(key) {
  if (COLUMN_BY_KEY[key]?.fixed) return
  const next = new Set(visibleKeys.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  visibleKeys.value = next
  persistColumns()
}
function resetColumns() {
  visibleKeys.value = new Set(DEFAULT_VISIBLE)
  persistColumns()
}

// Registry order wins, not click order, so toggling a column back on puts
// it where the user expects rather than at the end.
const visibleColumns = computed(() => COLUMNS.filter((c) => isVisible(c.key)))
const fixedColumns = computed(() => COLUMNS.filter((c) => c.fixed))
const shownColumns = computed(() => COLUMNS.filter((c) => !c.fixed && visibleKeys.value.has(c.key)))
const hiddenColumns = computed(() => COLUMNS.filter((c) => !c.fixed && !visibleKeys.value.has(c.key)))
// +1 for the checkbox column, which lives outside the registry.
const colspan = computed(() => visibleColumns.value.length + 1)

/* Sorting. Nulls always sort to the bottom regardless of direction, so a
 * never-run prompt never outranks one with real numbers. */
const sorted = computed(() => {
  const col = COLUMN_BY_KEY[sortKey.value]
  if (!col?.sort) return filtered.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const av = col.sort(a); const bv = col.sort(b)
    const an = av == null || av === ''; const bn = bv == null || bv === ''
    if (an && bn) return 0
    if (an) return 1
    if (bn) return -1
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv)) * dir
    }
    return (av - bv) * dir
  })
})

function setSort(key) {
  if (!COLUMN_BY_KEY[key]?.sort) return
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    // Position is "lower is better", so it opens ascending; so does any
    // text column, where A-Z is the natural first read.
    const col = COLUMN_BY_KEY[key]
    sortDir.value = col.asc || !col.num ? 'asc' : 'desc'
  }
}
function sortIcon(key) {
  if (sortKey.value !== key) return ChevronsUpDown
  return sortDir.value === 'asc' ? ChevronUp : ChevronDown
}

/* ── Pagination ──
 * Everything is already in memory, so this is purely about not rendering
 * 300 rows at once. Paginate the flat sorted list and group only the
 * current page -- grouping a page is predictable; paginating within groups
 * is not.
 */
const PAGE_SIZES = [25, 50, 100]
const pageSize = ref(25)
const page = ref(1)

const pageCount = computed(() =>
  pageSize.value === 0 ? 1 : Math.max(1, Math.ceil(sorted.value.length / pageSize.value)))

// Any filter/sort change can shrink the list under the current page.
watch([filtered, sortKey, sortDir, pageSize], () => { page.value = 1 })

const paged = computed(() => {
  if (pageSize.value === 0) return sorted.value
  const start = (page.value - 1) * pageSize.value
  return sorted.value.slice(start, start + pageSize.value)
})

const rangeStart = computed(() => (sorted.value.length ? (page.value - 1) * (pageSize.value || sorted.value.length) + 1 : 0))
const rangeEnd = computed(() => Math.min(rangeStart.value + paged.value.length - 1, sorted.value.length))

function goPage(n) {
  page.value = Math.min(Math.max(1, n), pageCount.value)
}

/* ── CSV export ──
 * Exports what you are looking at: current filters, current sort, current
 * columns. Exporting the raw unfiltered set would ignore the work the user
 * just did narrowing it down.
 */
function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
function exportCsv() {
  const cols = visibleColumns.value
  const lines = [cols.map((c) => csvCell(c.label)).join(',')]
  for (const row of sorted.value) {
    lines.push(cols.map((c) => csvCell((c.csv || c.sort || (() => ''))(row))).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `prompts-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* Grouping. Returns [{ key, label, rows }]. A single "All" group when off. */
const groups = computed(() => {
  const list = paged.value
  if (groupBy.value === 'none') return [{ key: '__all__', label: '', rows: list }]

  const buckets = new Map()
  const push = (key, label, row) => {
    if (!buckets.has(key)) buckets.set(key, { key, label, rows: [] })
    buckets.get(key).rows.push(row)
  }
  for (const row of list) {
    if (groupBy.value === 'topic') {
      push(row.topic || '__none__', row.topic || 'Default prompts', row)
    } else if (groupBy.value === 'status') {
      push(row.is_archived ? 'archived' : 'active', row.is_archived ? 'Archived' : 'Active', row)
    } else if (groupBy.value === 'tag') {
      const first = (row.tags || [])[0]
      push(first || '__none__', first || 'Untagged', row)
    }
  }
  return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label))
})

/* ── Cell helpers ──
 * Tooltips carry the detail that will not fit in a dense cell. Each one
 * degrades to '' so the title attribute simply disappears rather than
 * rendering the word "undefined".
 */
const neverRunCount = computed(() => rows.value.filter((r) => !r.responses_seen).length)

const ENGINE_LABELS = {
  claude: 'Claude', gpt4: 'ChatGPT', gemini: 'Gemini',
  perplexity: 'Perplexity', grok: 'Grok', deepseek: 'DeepSeek',
}
function engineName(provider) {
  return ENGINE_LABELS[provider] || provider
}

function engineTitle(row, provider) {
  const stat = (row.by_engine || []).find((e) => e.provider === provider)
  if (!stat) return engineName(provider)
  return `${engineName(provider)} — mentioned in ${stat.mentioned} of ${stat.responses} (${stat.visibility_pct}%)`
}

function competitorTitle(row) {
  const list = row.top_competitors || []
  if (!list.length) return ''
  const lines = list.map((c) => `${c.name} — named ${c.count}×`)
  const rest = row.competitors_count - list.length
  if (rest > 0) lines.push(`+${rest} more`)
  return lines.join('\n')
}

function domainTitle(row) {
  const list = row.top_domains || []
  if (!list.length) return ''
  return `${row.citations_count} citations\n` + list.map((d) => `${d.domain} — ${d.count}×`).join('\n')
}

function sentimentTitle(row) {
  const d = row.sentiment_dist || {}
  const total = (d.positive || 0) + (d.neutral || 0) + (d.negative || 0)
  if (!total) return ''
  return `${d.positive || 0} positive · ${d.neutral || 0} neutral · ${d.negative || 0} negative`
}

/* ── Selection + bulk actions ── */
const selectedIds = ref(new Set())
const bulkPending = ref(false)
// Scoped to the current page: a header checkbox that silently selects
// rows on pages you cannot see is a nasty surprise before a bulk delete.
const allSelected = computed(() =>
  paged.value.length > 0 && paged.value.every((r) => selectedIds.value.has(r.brand_prompt_id)))
function toggleRow(row) {
  const next = new Set(selectedIds.value)
  if (next.has(row.brand_prompt_id)) next.delete(row.brand_prompt_id)
  else next.add(row.brand_prompt_id)
  selectedIds.value = next
}
function toggleAll() {
  const next = new Set(selectedIds.value)
  if (allSelected.value) {
    for (const r of paged.value) next.delete(r.brand_prompt_id)
  } else {
    for (const r of paged.value) next.add(r.brand_prompt_id)
  }
  selectedIds.value = next
}
function selectedRows() {
  return rows.value.filter((r) => selectedIds.value.has(r.brand_prompt_id))
}

// Archive / Unarchive toggles the per-website BrandPrompt.is_archived
// flag (tenant-scoped) — not the shared catalog prompt.
async function bulkSetActive(active) {
  const targets = selectedRows()
  if (!targets.length) return
  bulkPending.value = true
  try {
    const results = await Promise.allSettled(
      targets.map((r) => promptLibrary.setArchived(r.brand_prompt_id, !active)),
    )
    const ok = results.filter((x) => x.status === 'fulfilled').length
    toast.success(`${active ? 'Unarchived' : 'Archived'} ${ok} prompt${ok === 1 ? '' : 's'}.`)
    selectedIds.value = new Set()
    await load()
  } catch (e) {
    toast.error(e?.displayMessage || 'Could not update prompts.')
  } finally {
    bulkPending.value = false
  }
}
async function bulkDelete() {
  const targets = selectedRows()
  if (!targets.length) return
  if (!window.confirm(`Delete ${targets.length} prompt${targets.length === 1 ? '' : 's'}? This can't be undone.`)) return
  bulkPending.value = true
  try {
    const results = await Promise.allSettled(targets.map((r) => promptLibrary.removeBrandPrompt(r.brand_prompt_id)))
    const ok = results.filter((x) => x.status === 'fulfilled').length
    toast.success(`Deleted ${ok} prompt${ok === 1 ? '' : 's'}.`)
    selectedIds.value = new Set()
    await load()
  } catch (e) {
    toast.error(e?.displayMessage || 'Could not delete prompts.')
  } finally {
    bulkPending.value = false
  }
}

function openDetail(row) {
  router.push(`/llm-ranking/${websiteId}/prompts/${row.id}/detail`)
}

/* ── Presentation helpers ── */
function sentimentClass(score) {
  if (score == null) return 'is-mute'
  if (score >= 70) return 'is-pos'
  if (score >= 50) return 'is-neu'
  return 'is-neg'
}
function demandBars(score) {
  const v = Number(score) || 0
  if (v >= 0.75) return 4
  if (v >= 0.5) return 3
  if (v >= 0.25) return 2
  if (v > 0) return 1
  return 0
}
// Normalize a tag to the CSS colour-class suffix (e.g. "non-branded" -> "nonbranded").
function tagClass(tag) { return String(tag || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function flag(code) {
  if (!code || code.length !== 2) return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)))
}
// Short date for the Last run / Next run columns (e.g. "Aug 16").
function shortDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fullDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}
// Full country name from an ISO-2 code (e.g. "LK" -> "Sri Lanka").
function countryName(code) {
  if (!code) return ''
  if (code.length !== 2) return code
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code
  } catch (_) {
    return code
  }
}

/* ── Modals ── */
const showHelpCreate = ref(false)
const helpGenerating = ref(false)
const helpError = ref('')

/* Seed the table with a deterministic, intent-diverse starter set. The
 * backend saves the prompts directly (deduped on text hash), so the only
 * follow-up is the usual table refetch. */
async function generateSamples() {
  if (helpGenerating.value) return
  helpGenerating.value = true
  helpError.value = ''
  try {
    const { data } = await promptLibrary.generateSamples(websiteId, { count: 10 })
    const added = data?.created_count ?? 0
    toast.success(added
      ? `Added ${added} sample prompt${added === 1 ? '' : 's'}. Run a scan when you're ready.`
      : 'These sample prompts are already in your list.')
    showHelpCreate.value = false
    await load()
  } catch (e) {
    helpError.value = e?.response?.data?.error?.message
      || e.displayMessage
      || "We couldn't generate prompts. Please try again."
  } finally {
    helpGenerating.value = false
  }
}

/* ── Add prompt / bulk upload modal ── */
const showAdd = ref(false)
const addTab = ref('add')
const addText = ref('')
const addTopic = ref('')
const addLocation = ref('US')
const addTags = ref([])
const addPending = ref(false)
// 'security' routes the prompt through the cold security-perception path:
// no crawled context is sent to the models and security claims are extracted.
const TAG_PRESETS = ['branded', 'non-branded', 'informational', 'transactional', 'security']
const LOCATIONS = ref([{ code: 'US', name: 'United States' }])

async function loadRegions() {
  try {
    const { data } = await promptLibrary.getRegions()
    const list = (data || {}).countries || []
    if (list.length) LOCATIONS.value = list
  } catch (_) { /* keep the default */ }
}

/* ── Model selection (Models tab) ── */
const PROVIDER_LABELS = {
  claude: 'Claude', gpt4: 'ChatGPT (OpenAI)', gemini: 'Gemini',
  perplexity: 'Perplexity', grok: 'Grok', deepseek: 'DeepSeek',
}
const variantsCatalog = ref([])
const addModels = ref([])

async function loadModelVariants() {
  try {
    const { data } = await llmRankingApi.modelVariants(websiteId)
    variantsCatalog.value = (data || {}).variants || []
    // First open before the user touches anything: defaults pre-checked.
    if (!addModels.value.length) addModels.value = defaultModelIds()
  } catch (_) { /* tab shows a loading line; selection stays optional */ }
}
function defaultModelIds() {
  return variantsCatalog.value
    .filter((v) => v.configured && v.is_default)
    .map((v) => v.id)
}
const variantGroups = computed(() => {
  const order = []
  const byProvider = new Map()
  for (const v of variantsCatalog.value) {
    if (!byProvider.has(v.provider)) {
      byProvider.set(v.provider, {
        provider: v.provider,
        label: PROVIDER_LABELS[v.provider] || v.provider,
        configured: false,
        variants: [],
      })
      order.push(v.provider)
    }
    const g = byProvider.get(v.provider)
    g.variants.push(v)
    g.configured = g.configured || !!v.configured
  }
  return order.map((p) => byProvider.get(p))
})
function toggleModel(id) {
  const i = addModels.value.indexOf(id)
  if (i >= 0) {
    if (addModels.value.length === 1) {
      toast.error('Keep at least one model selected.')
      return
    }
    addModels.value.splice(i, 1)
  } else {
    addModels.value.push(id)
  }
}
const promptCount = computed(() =>
  addText.value.split('\n').map((l) => l.trim()).filter(Boolean).length)

function resetAddForm() {
  addText.value = ''
  addTags.value = []
  addLocation.value = 'US'
  addTab.value = 'add'
  addModels.value = defaultModelIds()
}
function openAddPrompt() {
  resetAddForm()
  addTopic.value = activeTopic.value || ''
  showAdd.value = true
}
function toggleTag(tag) {
  const i = addTags.value.indexOf(tag)
  if (i >= 0) addTags.value.splice(i, 1)
  else addTags.value.push(tag)
}
async function submitAdd() {
  const text = addText.value.trim()
  if (!text) { toast.error('Enter at least one prompt.'); return }
  addPending.value = true
  try {
    // Send the model selection only when it differs from the default set:
    // an untouched selection keeps the classic "every provider's default
    // model" scan path.
    const defaults = new Set(defaultModelIds())
    const isDefaultSet =
      addModels.value.length === defaults.size &&
      addModels.value.every((id) => defaults.has(id))
    const res = await promptLibrary.createWebsitePrompt(websiteId, {
      text,
      topic: addTopic.value.trim(),
      location: addLocation.value,
      tags: addTags.value,
      intent_bucket: 'category',
      style: 'question',
      models: isDefaultSet ? [] : addModels.value,
    })
    const body = res?.data || {}
    const n = body.created_count || promptCount.value
    toast.success(`Added ${n} prompt${n === 1 ? '' : 's'} · scanning…`)
    showAdd.value = false
    const t = addTopic.value.trim()
    if (t) activeTopic.value = t
    await load()
  } catch (e) {
    toast.error(e?.displayMessage || 'Could not add prompt.')
  } finally {
    addPending.value = false
  }
}

/* Bulk CSV: one prompt per row (a leading "prompt" header is ignored). */
function downloadCsvExample() {
  const sample = 'prompt\nbest budgeting apps in 2026\nalternatives to rocket money\nhow do I automate my savings\n'
  const blob = new Blob([sample], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'prompts-example.csv'
  a.click()
  URL.revokeObjectURL(url)
}
function parseCsv(content) {
  const csvRows = content.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
  if (csvRows.length && /^"?prompts?"?$/i.test(csvRows[0])) csvRows.shift()
  return csvRows.map((r) => r.split(',')[0].replace(/^"|"$/g, '').trim()).filter(Boolean)
}
async function onCsvFile(e) {
  const file = (e.target.files || e.dataTransfer?.files || [])[0]
  if (!file) return
  const content = await file.text()
  const prompts = parseCsv(content)
  if (!prompts.length) { toast.error('No prompts found in that file.'); return }
  addText.value = prompts.join('\n')
  addTab.value = 'add'
  toast.success(`Loaded ${prompts.length} prompts — review and add.`)
}

// appStore kept for future website-scoped context; referenced to avoid an unused binding.
void appStore
</script>

<style scoped>
/* ── Column menu ── */
.spd-colmenu-wrap { position: relative; display: inline-flex; }
.spd-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--muted-foreground);
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.spd-icon-btn:hover:not(:disabled) { color: var(--foreground); border-color: var(--ring); }
.spd-icon-btn.is-on {
  color: var(--primary);
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}
.spd-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Backdrop closes the menu on any outside click. It sits below the panel
   so it never intercepts the checkbox clicks inside it. */
.spd-colmenu-backdrop { position: fixed; inset: 0; z-index: 40; }
.spd-colmenu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 41;
  width: 220px;
  max-height: min(70vh, 480px);
  overflow-y: auto;
  padding: 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
}
.spd-colmenu-head {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  padding: 8px 6px 4px;
}
.spd-colmenu-head:first-child { padding-top: 2px; }
.spd-colmenu-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--foreground);
  cursor: pointer;
  transition: background 0.12s;
}
.spd-colmenu-row:hover { background: var(--muted); }
.spd-colmenu-row.is-fixed { opacity: 0.55; cursor: default; }
.spd-colmenu-row.is-fixed:hover { background: transparent; }
.spd-colmenu-row input { cursor: inherit; }
.spd-colmenu-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
}
.spd-colmenu-reset {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
  transition: color 0.15s;
}
.spd-colmenu-reset:hover { color: var(--foreground); }

/* ── KPI strip ── */
.spd-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
.spd-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 106px;
  padding: 8px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
}
.spd-kpi-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.spd-kpi-val {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 17px;
  font-weight: 700;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
}

/* ── Sorted-column emphasis ── */
.spd-table th.is-sorted { color: var(--foreground); }

/* ── Visibility bar ── */
.spd-vis-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 52px;
}
.spd-vis-track {
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: var(--muted);
  overflow: hidden;
}
.spd-vis-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width 0.25s ease;
}

/* ── Mentions fraction ── */
.spd-frac { font-variant-numeric: tabular-nums; font-weight: 600; }
.spd-frac-sep { color: var(--muted-foreground); margin: 0 1px; }
.spd-frac-den { color: var(--muted-foreground); font-weight: 500; }

/* ── Competitors ── */
.spd-comps { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
.spd-comp {
  max-width: 92px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spd-comp-more {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

/* ── Intent pill ── */
.spd-pill {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted-foreground);
  text-transform: capitalize;
}

/* ── Pager ── */
.spd-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 11px 14px;
  border-top: 1px solid var(--border);
}
.spd-pager-range { font-size: 12px; color: var(--muted-foreground); }
.spd-pager-controls { display: flex; align-items: center; gap: 8px; }
.spd-pager-size { flex-shrink: 0; }
.spd-pager-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--muted-foreground);
  transition: color 0.15s, border-color 0.15s;
}
.spd-pager-btn:hover:not(:disabled) { color: var(--foreground); border-color: var(--ring); }
.spd-pager-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.spd-pager-page {
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  min-width: 44px;
  text-align: center;
}

.spd { display: flex; flex-direction: column; gap: 14px; }

/* ── Toolbar ── */
.spd-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.spd-toolbar-left, .spd-toolbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.spd-search-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 240px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}
.spd-search-wrap svg { color: var(--muted-foreground); }
.spd-search {
  flex: 1;
  border: none;
  background: transparent;
  padding: 9px 0;
  font: inherit;
  font-size: 0.88rem;
  color: var(--foreground);
}
.spd-search:focus { outline: none; }

.spd-segmented {
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  background: var(--muted);
  border-radius: 10px;
}
.spd-seg-btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 8px;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted-foreground);
  cursor: pointer;
}
.spd-seg-btn.is-on { background: var(--card); color: var(--foreground); font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }

.spd-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}
.spd-field svg { color: var(--muted-foreground); }
.spd-select {
  appearance: none;
  border: none;
  background: transparent;
  padding: 8px 4px;
  font: inherit;
  font-size: 0.85rem;
  color: var(--foreground);
  cursor: pointer;
}
.spd-select:focus { outline: none; }

.spd-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--foreground);
  cursor: pointer;
}
.spd-btn:hover { background: var(--muted); }
.spd-btn svg { color: var(--muted-foreground); }
.spd-btn-primary { background: var(--foreground); color: var(--primary-foreground); border-color: var(--foreground); }
.spd-btn-primary:hover { opacity: 0.92; background: var(--foreground); }
.spd-btn-primary svg { color: var(--primary-foreground); }

/* Neon halo for the AI prompt-generation entry point. The glow is a
   blurred conic gradient on a ::before layered BEHIND the button; the
   button keeps its solid --card background so the label stays readable
   in both themes. Hue rotation animates the colors without needing
   @property support. */
.spd-btn-neon {
  position: relative;
  isolation: isolate;
  border-color: transparent;
  background:
    linear-gradient(var(--card), var(--card)) padding-box,
    linear-gradient(120deg, #6366f1, #ec4899, #f59e0b, #22d3ee) border-box;
}
.spd-btn-neon::before {
  content: '';
  position: absolute;
  inset: -3px;
  z-index: -1;
  border-radius: 13px;
  background: conic-gradient(#6366f1, #ec4899, #f59e0b, #22d3ee, #6366f1);
  filter: blur(10px);
  opacity: 0.55;
  animation: spd-neon-hue 6s linear infinite;
}
.spd-btn-neon:hover::before { opacity: 0.85; }
.spd-btn-neon svg { color: #ec4899; }
@keyframes spd-neon-hue {
  to { filter: blur(10px) hue-rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .spd-btn-neon::before { animation: none; }
}

.spd-empty-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }

/* ── Tag filter row ── */
.spd-tagfilter { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.spd-tagfilter-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.78rem; font-weight: 600; color: var(--muted-foreground);
  text-transform: uppercase; letter-spacing: 0.04em; margin-right: 2px;
}
.spd-tag-btn { appearance: none; border: 1px solid transparent; cursor: pointer; }
.spd-tag-btn.is-selected { outline: 2px solid var(--foreground); outline-offset: 1px; }
.spd-tag-clear {
  appearance: none; display: inline-flex; align-items: center; gap: 3px;
  border: none; background: transparent; cursor: pointer;
  font: inherit; font-size: 0.78rem; color: var(--muted-foreground);
}
.spd-tag-clear:hover { color: var(--foreground); }

/* ── Count line ── */
.spd-countline {
  font-size: 0.82rem;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  padding: 0 2px;
}

/* ── Bulk bar ── */
.spd-bulkbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px;
  background: color-mix(in oklab, var(--foreground) 6%, var(--card));
  border: 1px solid var(--border);
  border-radius: 12px;
}
.spd-bulk-count { font-size: 0.85rem; font-weight: 600; color: var(--foreground); }
.spd-bulk-actions { display: inline-flex; gap: 8px; }
.spd-bulk-btn {
  appearance: none; display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--card); font: inherit; font-size: 0.82rem; font-weight: 500;
  color: var(--foreground); cursor: pointer;
}
.spd-bulk-btn:hover { background: var(--muted); }
.spd-bulk-btn:disabled { opacity: 0.5; cursor: default; }
.spd-bulk-btn svg { color: var(--muted-foreground); }
.spd-bulk-danger { color: #b91c1c; }
.spd-bulk-danger svg { color: #b91c1c; }
.spd-bulk-ghost { border-color: transparent; background: transparent; color: var(--muted-foreground); }

/* ── Table ── */
.spd-table-wrap {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.spd-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.spd-table th {
  text-align: left;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
  padding: 12px 14px;
  background: var(--muted);
  border-bottom: 1px solid var(--border);
}
.spd-table th.num, .spd-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.spd-th-check { width: 36px; }
.spd-th-prompt { width: auto; }
.spd-th-with-icon { display: inline-flex; align-items: center; gap: 4px; }
.spd-th-sort { cursor: pointer; user-select: none; }
.spd-th-sort:hover { color: var(--foreground); }
.spd-table td {
  padding: 14px;
  color: var(--foreground);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.spd-table tbody tr { cursor: pointer; transition: background 0.12s ease; }
.spd-table tbody tr:hover { background: var(--muted); }
.spd-table tbody tr:last-child td { border-bottom: none; }
.spd-td-prompt { font-weight: 500; color: var(--foreground); }
.spd-mute { color: var(--muted-foreground); }

/* Group header rows */
.spd-group-row { cursor: default; }
.spd-group-row:hover { background: transparent; }
.spd-group-head {
  background: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
  padding: 8px 14px;
}
.spd-group-count {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--card);
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.spd-vis { font-weight: 600; }
.spd-pos { font-weight: 500; }
.spd-sent-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--muted-foreground); margin-right: 4px; vertical-align: middle;
}
.spd-sent-dot.is-pos { background: #10b981; }
.spd-sent-dot.is-neu { background: #6b7280; }
.spd-sent-dot.is-neg { background: #ef4444; }

.spd-mentions { display: inline-flex; align-items: center; }
.spd-mention-dot {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--card); margin-left: -6px; display: inline-block;
}
.spd-mention-dot:first-child { margin-left: 0; }
.spd-mention-dot.is-claude { background: #ec6e3b; }
.spd-mention-dot.is-gpt4 { background: #34d399; }
.spd-mention-dot.is-gemini { background: #5b8def; }
.spd-mention-dot.is-perplexity { background: #1ea7a0; }
.spd-mention-dot.is-deepseek { background: #6366f1; }
.spd-mention-more { font-size: 0.75rem; color: var(--muted-foreground); margin-left: 6px; }

.spd-volume { display: inline-flex; gap: 2px; align-items: end; }
.spd-vol-bar { width: 4px; height: 8px; border-radius: 1px; background: var(--border); }
.spd-vol-bar:nth-child(2) { height: 11px; }
.spd-vol-bar:nth-child(3) { height: 14px; }
.spd-vol-bar:nth-child(4) { height: 17px; }
.spd-vol-bar.is-on { background: #10b981; }

.spd-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  margin-right: 4px;
  background: var(--muted);
  color: var(--muted-foreground);
}
.spd-tag.is-branded { background: rgba(37, 99, 235, 0.10); color: #1d4ed8; }
.spd-tag.is-nonbranded { background: rgba(245, 158, 11, 0.10); color: #b45309; }
.spd-tag.is-recommendation,
.spd-tag.is-transactional { background: rgba(239, 68, 68, 0.10); color: #b91c1c; }
.spd-tag.is-comparison { background: rgba(99, 102, 241, 0.10); color: #4338ca; }
.spd-tag.is-use_case,
.spd-tag.is-usecase,
.spd-tag.is-informational { background: rgba(6, 182, 212, 0.10); color: #0e7490; }
.spd-tag.is-persona { background: rgba(16, 185, 129, 0.10); color: #047857; }

.spd-loc { color: var(--muted-foreground); }

/* Last run / Next run columns */
.spd-runcell { white-space: nowrap; font-variant-numeric: tabular-nums; font-size: 0.82rem; }
.spd-next { font-weight: 600; color: var(--foreground); }
.spd-freq {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.66rem;
  font-weight: 600;
  text-transform: capitalize;
}

/* ── Empty state + spinner ── */
.spd-empty {
  padding: 60px 24px;
  text-align: center;
  color: var(--muted-foreground);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.spd-empty h3 { margin: 6px 0 4px; color: var(--foreground); font-size: 1rem; }
.spd-empty p { margin: 0; font-size: 0.88rem; }
.spd-add-empty { margin-top: 10px; }
.spd-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--foreground);
  animation: spd-spin 0.7s linear infinite;
}
@keyframes spd-spin { to { transform: rotate(360deg); } }
</style>
