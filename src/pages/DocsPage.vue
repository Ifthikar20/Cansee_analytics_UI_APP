<script setup>
/**
 * Public documentation page (/docs).
 *
 * A self-contained docs shell (top bar with search, a section sidebar,
 * the content column, and an FAQ rail) styled through the app's design
 * tokens so it themes light/dark with the rest of Cansee. Each section
 * describes a screen that exists in the app.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { SUPPORT_EMAIL } from '@/constants/support'
import { ENGINES } from '@/lib/engines'
import { featuredFaqs } from '@/lib/help/faq'
import { useAuthStore } from '@/stores/auth'
import { useHelpStore } from '@/stores/help'
import { useHelpShortcut } from '@/composables/useHelpShortcut'
import HelpDrawer from '@/components/help/HelpDrawer.vue'

const navGroups = [
  { title: 'Get started', items: [
    { id: 'welcome', label: 'What Cansee does' },
    { id: 'quickstart', label: 'Quick start' },
    { id: 'engines', label: 'The AI engines' },
  ] },
  { title: 'The app', items: [
    // Section ids stay as they were, so older /docs#overview links still land.
    { id: 'overview', label: 'Analytics' },
    { id: 'ask-ai', label: 'Ask AI' },
    { id: 'prompt', label: 'Prompt detail' },
    { id: 'sources', label: 'Citations' },
  ] },
  { title: 'Agent', items: [
    { id: 'agent', label: 'The Agent' },
    { id: 'research', label: 'Research agents' },
    { id: 'findings', label: 'Findings' },
    { id: 'reports', label: 'Reports' },
  ] },
  { title: 'Settings', items: [
    { id: 'project', label: 'Project' },
    { id: 'autopilot', label: 'Autopilot' },
    { id: 'connections', label: 'Connections' },
    { id: 'brand-facts', label: 'Brand facts' },
    { id: 'team', label: 'Team' },
    { id: 'billing', label: 'Billing' },
  ] },
  { title: 'Reference', items: [
    { id: 'scoring', label: 'How the gap is scored' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'contact', label: 'Contact' },
  ] },
]

// The rail's questions come from the help center's one list (lib/help/faq.js).
const faqs = featuredFaqs('docs')

const supportHref = `mailto:${SUPPORT_EMAIL}`

const auth = useAuthStore()
const help = useHelpStore()
useHelpShortcut()

// ── Section navigation state ───────────────────────────────────────────
const activeId = ref('welcome')
const navOpen = ref(false)
const rootEl = ref(null)
let observer = null

function goTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  navOpen.value = false
  clearSearch()
}

// ── Search ─────────────────────────────────────────────────────────────
const query = ref('')
let index = []
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return index
    .filter((x) => (x.title + ' ' + x.text).toLowerCase().includes(q))
    .slice(0, 8)
})
const sel = ref(0)
function clearSearch() { query.value = ''; sel.value = 0 }
function onSearchKey(e) {
  if (!results.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); sel.value = Math.min(sel.value + 1, results.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel.value = Math.max(sel.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); const r = results.value[sel.value]; if (r) goTo(r.id) }
  else if (e.key === 'Escape') { clearSearch() }
}

onMounted(() => {
  // Build the search index + scrollspy from the rendered content.
  const scope = rootEl.value
  if (!scope) return
  const nodes = scope.querySelectorAll('.dx-main section, .dx-main .service[id]')
  index = Array.from(nodes).map((s) => {
    const h = s.querySelector('h2, h3')
    const p = s.querySelector('p:not(.kicker):not(.need)')
    return {
      id: s.id,
      title: h ? h.textContent.trim() : s.id,
      text: s.textContent.replace(/\s+/g, ' ').trim(),
      snip: (p ? p.textContent : '').replace(/\s+/g, ' ').trim(),
    }
  }).filter((x) => x.id)

  const sections = Array.from(scope.querySelectorAll('.dx-main section, .dx-main .service[id]'))
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) activeId.value = e.target.id })
    }, { rootMargin: '-12% 0px -75% 0px' })
    sections.forEach((s) => observer.observe(s))
  }

  const onSlash = (e) => {
    if (help.isOpen) return
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault()
      scope.querySelector('.dx-search-input')?.focus()
    }
  }
  document.addEventListener('keydown', onSlash)
  onBeforeUnmount(() => document.removeEventListener('keydown', onSlash))
})
onBeforeUnmount(() => { if (observer) observer.disconnect() })
</script>

<template>
  <div class="docs" ref="rootEl">
    <!-- Top bar -->
    <header class="dx-top">
      <button class="dx-menu" type="button" aria-label="Open navigation" @click="navOpen = !navOpen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      <router-link to="/" class="dx-brand">
        <span class="dx-mark">Cansee</span><span class="dx-tag">Docs</span>
      </router-link>
      <div class="dx-search">
        <svg class="dx-search-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input
          class="dx-search-input"
          type="text"
          placeholder="Search the docs"
          autocomplete="off"
          aria-label="Search documentation"
          v-model="query"
          @keydown="onSearchKey"
        />
        <span class="dx-kbd">/</span>
        <div v-if="query.trim()" class="dx-results">
          <button
            v-for="(r, i) in results"
            :key="r.id"
            type="button"
            class="dx-sr"
            :class="{ sel: i === sel }"
            @click="goTo(r.id)"
            @mouseenter="sel = i"
          >
            <span class="dx-sr-t">{{ r.title }}</span>
            <span class="dx-sr-s">{{ r.snip.slice(0, 78) }}</span>
          </button>
          <p v-if="!results.length" class="dx-sr-empty">No matches. Try “gap”, “engines” or “Citations”.</p>
        </div>
      </div>
      <div class="dx-spacer"></div>
      <a class="dx-link hide-sm" :href="supportHref">Contact</a>
      <router-link to="/" class="dx-link hide-sm">Home</router-link>
      <router-link v-if="auth.isAuthenticated" to="/dashboard" class="dx-cta">Open app</router-link>
      <router-link v-else to="/login" class="dx-cta">Sign in</router-link>
    </header>

    <div class="dx-shell">
      <!-- Sidebar -->
      <aside class="dx-side" :class="{ open: navOpen }">
        <nav v-for="g in navGroups" :key="g.title" class="dx-grp">
          <p class="dx-grp-t">{{ g.title }}</p>
          <a
            v-for="it in g.items"
            :key="it.id"
            :href="`#${it.id}`"
            class="dx-navlink"
            :class="{ active: activeId === it.id }"
            @click.prevent="goTo(it.id)"
          >{{ it.label }}</a>
        </nav>
      </aside>
      <div class="dx-scrim" :class="{ open: navOpen }" @click="navOpen = false"></div>

      <!-- Content -->
      <main class="dx-main">
        <div class="dx-inner prose">
          <p class="dx-crumb">Docs <span aria-hidden="true">›</span> <strong>Introduction</strong></p>

          <div class="dx-hero">
            <h1>Your brand on Google and in AI answers</h1>
            <p class="lede">Cansee takes the questions your buyers ask, checks where your site ranks on Google for each one, and asks five AI engines (ChatGPT, Claude, Gemini, Grok and Perplexity) the same question. It shows where Google and the AI answers disagree about you, and what to change.</p>
          </div>

          <section id="welcome">
            <h2>What Cansee does</h2>
            <p class="kicker">The short version.</p>
            <p>Each question you track is a <strong>prompt</strong>. For every prompt, Cansee records two things: where your site ranks on Google, and what each AI engine answered. Comparing them shows the gap: prompts where AI recommends you but Google ranks you low, prompts where Google ranks you but AI leaves you out, and prompts where neither surfaces you.</p>
            <p>For each prompt, Cansee then lists what to change and names the pages to work on.</p>
          </section>

          <section id="quickstart">
            <h2>Quick start</h2>
            <p class="kicker">From your website to your first comparison.</p>
            <ol class="steps">
              <li><strong>Add your project.</strong> Enter your website. Cansee reads your homepage to draft a description of the business, starter prompts and competitors to compare you with. Check them and change anything that is off.</li>
              <li><strong>Add prompts.</strong> On Analytics, choose <em>Add prompts</em> in Prompts and enter the questions your buyers ask, one per line, without your brand name. Pick the country to search from. The AI engines are asked right away.</li>
              <li><strong>Check Google.</strong> Choose <em>Check Google</em> in Prompts to look up where your site ranks for each prompt.</li>
              <li><strong>Open a prompt.</strong> See Google next to each engine, the brands recommended instead of you, the pages the engines cite, and a ranked list of what to change.</li>
            </ol>
          </section>

          <section id="engines">
            <h2>The AI engines</h2>
            <p class="kicker">Who Cansee asks on your behalf.</p>
            <p>Every prompt goes to the same engines, so you can see which ones bring you up and which leave you out.</p>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Engine</th><th>Made by</th></tr></thead>
                <tbody>
                  <tr v-for="e in ENGINES" :key="e.key"><td>{{ e.label }}</td><td>{{ e.maker }}</td></tr>
                </tbody>
              </table>
            </div>
            <p>If an engine isn't available, a prompt's detail says so instead of leaving it out. The Google check also shows whether Google displayed an AI Overview for the prompt, and whether it mentions or cites you.</p>
          </section>

          <section id="overview">
            <h2>Analytics</h2>
            <p class="kicker">One board of widgets for the active project.</p>
            <p>The board starts with a row of four small cards (Watch, Asked and answered, Rank in AI answers and Visibility score), then Ask AI and Prompt ranking. <em>Add widget</em>, the plus beside the board's name, puts more on it, such as Summary, Prompts, Countries, Traffic, Sentiment or Citations; drag a card by its top to move it, or use its menu to move, resize or remove it. Your board is saved for you. Open a card's title, or <em>Expand</em> in its menu, to see its detail in a side panel.</p>
            <ul>
              <li><strong>Ask AI.</strong> Type a question your buyers ask. Cansee asks each AI engine several times, after showing what it will cost, and shows how often you are named, at what rank, and the answers. Track it to keep checking it.</li>
              <li><strong>Prompt ranking.</strong> Your tracked prompts, ranked by how often the AI engines name you, with each prompt's Google result.</li>
              <li><strong>Summary.</strong> AI visibility (the share of recent AI answers that name you), your average Google position, and how many prompts are AI ahead or Google ahead. Expanded, it adds the gap, prompt by prompt: a map where further left is better on Google and higher up is better in AI answers.</li>
              <li><strong>Prompts.</strong> The biggest gaps between Google and the AI engines. Expanded, a table with your Google position, each engine's result, the gap and the top fix, biggest gaps first. Filter by gap, then open a prompt.</li>
              <li><strong>Who AI recommends.</strong> The share of the latest answers that name each brand, you included.</li>
            </ul>
            <p class="need"><span class="need-l">You need</span> a project and at least one prompt. Google positions appear once Google has been checked.</p>
          </section>

          <section id="ask-ai">
            <h2>Ask AI</h2>
            <p class="kicker">The Ask AI widget on Analytics.</p>
            <p>Type a question your buyers ask. Cansee asks each AI engine the same question several times (3 by default, up to 10), because answers vary from run to run, and shows how often you are named, at what rank, and the answers themselves. It shows what the run will use before it starts.</p>
            <p>Ask AI answers are not added to your tracked numbers. Choose <em>Track</em> to add the question as a prompt and keep checking it.</p>
            <p class="need"><span class="need-l">Free plan</span> every engine answer counts as one prompt run.</p>
          </section>

          <section id="prompt">
            <h2>Prompt detail</h2>
            <p class="kicker">Open any prompt from Prompts on Analytics. It opens in the side panel.</p>
            <p>Everything Cansee knows about one prompt, from top to bottom:</p>
            <ul>
              <li><strong>The verdict.</strong> One line on how your AI score compares with your Google score.</li>
              <li><strong>Where to change.</strong> Actions ranked by how big the gap is and how many engines it affects, each naming the pages to work on.</li>
              <li><strong>Google next to every engine.</strong> Your Google position and the page-one results you are up against, then each engine's latest answer: whether it named you and at what rank, the brands it listed above you, and the pages it cited. Open an answer to read it in full, with its brand alignment score.</li>
              <li><strong>What AI gets wrong.</strong> Claims in these answers that conflict with your brand facts.</li>
            </ul>
            <p><em>Check now</em> looks Google up again and asks any engine that hasn't answered yet. <em>Schedule</em> runs the prompt daily, weekly or monthly. <em>Archive</em> stops it running and removes it from Prompts.</p>
            <p class="need"><span class="need-l">You need</span> answers from at least one engine. With Search Console connected, the Google column also shows real clicks, impressions and average position for the exact query.</p>
          </section>

          <section id="sources">
            <h2>Citations</h2>
            <p class="kicker">The Citations widget on Analytics.</p>
            <p>Every web page the AI engines pulled up while answering your prompts.</p>
            <ul>
              <li><strong>At the top.</strong> How many pages were retrieved, and how many came from your site, from competitors and from third parties.</li>
              <li><strong>What to do next.</strong> Your pages AI cites but Google buries, third-party pages that feed answers naming your competitors, and your pages that are working.</li>
              <li><strong>Charts.</strong> Retrievals over time for the most-used domains, the pages gaining and losing ground, and the mix of page types.</li>
              <li><strong>URLs.</strong> Every retrieved page with its type, the engines that used it, retrievals and citation rate. Filter by period and engine, switch between your pages, competitors and third parties, and open a page for its own history.</li>
            </ul>
            <p class="need"><span class="need-l">You need</span> prompts the engines have answered. Google clicks for your own pages, and some suggestions, need Search Console connected.</p>
          </section>

          <section id="agent">
            <h2>The Agent</h2>
            <p class="kicker">Agent in the header. A chat that researches your rankings and writes drafts.</p>
            <p>The general agents (Gap Analyst, Landing page, AEO article and Ad campaign) start a chat. The specialists (Page Optimizer, Comparison page, Social posts, PR, llms.txt and Messaging brief) ask for their inputs first, then draft the task into a new chat for you to send.</p>
            <ul>
              <li><strong>Context.</strong> What the agents know about your project, with its sources, plus documents you add. <em>Build from my site</em> suggests entries for you to accept; the agents use active entries only.</li>
              <li><strong>Reviews.</strong> Ask a teammate to review a draft. An approval records who approved which version and publishes nothing; a newer version needs a new approval.</li>
            </ul>
            <p>When the Agent cannot run, it says why: it is not set up on this workspace, messages are arriving faster than it can take them, or the allowance is used up.</p>
          </section>

          <section id="research">
            <h2>Research agents</h2>
            <p class="kicker">Research planned from a chat.</p>
            <p>The Agent can plan research across five areas: Google (SEO), AI engines (GEO), competitor pages, your site and content gaps, and sources and citations. The results come back as a table you can re-run. Research runs are private to you.</p>
            <p class="need"><span class="need-l">Free plan</span> each AI engine answer a research run asks for counts as one prompt run.</p>
          </section>

          <section id="findings">
            <h2>Findings</h2>
            <p class="kicker">Agent › Findings.</p>
            <p>The issues and opportunities from research, shared with everyone on the project. Add them from a research table or by hand, then mark them done or dismissed. Viewers can read them but not change them.</p>
          </section>

          <section id="reports">
            <h2>Reports</h2>
            <p class="kicker">Agent › Reports, Documents and Sheets.</p>
            <p>The Gap Analyst writes reports. Other drafts are under Documents (pages and documents) and Sheets (ad campaigns).</p>
            <p>A report can follow one of seven templates: Executive summary, Google vs AI gap, Competitor comparison, Prompt deep dive, Sources and citations, Brand accuracy, and Change log since the last run. Pick one when you start a report, or for the next reply in a chat.</p>
            <p>Use <em>Export</em> once a draft is finished: reports and documents as Markdown, HTML, or Print or save as PDF; sheets as CSV, TSV, or Copy as table.</p>
          </section>

          <section id="settings">
            <h2>Settings</h2>
            <p class="kicker">Settings in the header. Project pages apply to the project picked next to the logo.</p>

            <div class="service" id="project">
              <div class="svc-head"><h3>Project</h3><span class="svc-where">Settings › Project</span></div>
              <p>The project's name, website, industry and a short description of what the business does. Below that are your competitors (up to 25, each a name and a domain): Cansee flags them when they outrank you on Google or are recommended ahead of you. You can also delete the project here.</p>
            </div>

            <div class="service" id="autopilot">
              <div class="svc-head"><h3>Autopilot</h3><span class="svc-where">Settings › Autopilot</span></div>
              <p>On the 100 and 200 prompt plans, Autopilot asks every tracked prompt once a day. It pauses after 3 failed runs in a row: check the last run here, then turn it back on.</p>
            </div>

            <div class="service" id="connections">
              <div class="svc-head"><h3>Connections</h3><span class="svc-where">Settings › Connections</span></div>
              <p><strong>Google Search Console</strong> adds your real Google clicks, impressions and average position to each prompt and to your own pages in Citations. You sign in with Google and pick the property for the project.</p>
              <p><strong>Where reports go</strong> connects a Slack, Discord or Microsoft Teams channel through a webhook, so Cansee can post the daily report there.</p>
            </div>

            <div class="service" id="brand-facts">
              <div class="svc-head"><h3>Brand facts</h3><span class="svc-where">Settings › Brand facts</span></div>
              <p>What is true about your brand. Add a page URL (or crawl the whole site from it), paste content, write a quick note, or allow the Cansee agent to crawl your site on its own. Cansee checks the AI answers against these facts: they drive the brand alignment score on each answer and the <em>What AI gets wrong</em> list on each prompt.</p>
              <div class="note">
                <span class="note-label">Worth knowing</span>
                <p>Adding facts here does not change what the AI engines say. Nobody can retrain them from the outside. It lets Cansee measure where the answers differ from your facts.</p>
              </div>
            </div>

            <div class="service" id="team">
              <div class="svc-head"><h3>Team</h3><span class="svc-where">Settings › Team</span></div>
              <p>Organization accounts only. See who has access and their role. Admins invite people by email as Members or Viewers; only the owner can make someone an Admin. Under <em>Domains &amp; SSO</em>, admins can also verify your email domain and require Google sign-in for everyone.</p>
            </div>

            <div class="service" id="billing">
              <div class="svc-head"><h3>Billing</h3><span class="svc-where">Settings › Subscription</span></div>
              <p>The Free plan includes 20 prompt runs a month. One run is one prompt answered by one AI engine, so one prompt asked to all five engines uses 5 runs. The runs are shared by all your projects and reset at the start of each month.</p>
              <p>Your current plan and when it renews. Upgrade through a secure checkout, and use <em>Manage billing</em> to change plans, update payment details or see invoices. You can cancel or resume a subscription here too. If your organization pays for your seat, its admins handle billing.</p>
            </div>
          </section>

          <section id="scoring">
            <h2>How the gap is scored</h2>
            <p class="kicker">Two scores out of 100 for every prompt, and the difference between them.</p>
            <h3>Search score</h3>
            <p>From your Google position for the prompt.</p>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Google position</th><th>Search score</th></tr></thead>
                <tbody>
                  <tr><td>#1 to #3</td><td>100</td></tr>
                  <tr><td>#4 to #10</td><td>80</td></tr>
                  <tr><td>#11 to #20</td><td>55</td></tr>
                  <tr><td>#21 to #50</td><td>30</td></tr>
                  <tr><td>#51 to #100</td><td>15</td></tr>
                  <tr><td>Not found</td><td>0</td></tr>
                </tbody>
              </table>
            </div>
            <h3>AI score</h3>
            <p>Per engine, over its most recent answers (up to five): the share of answers that name you, multiplied by the average weight of those mentions. A prompt's AI score is the average over the engines that have answered.</p>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Where the answer names you</th><th>Weight</th></tr></thead>
                <tbody>
                  <tr><td>#1 to #3</td><td>100</td></tr>
                  <tr><td>#4 to #5</td><td>80</td></tr>
                  <tr><td>#6 to #10</td><td>55</td></tr>
                  <tr><td>#11 or lower</td><td>30</td></tr>
                  <tr><td>Named without a rank</td><td>55</td></tr>
                </tbody>
              </table>
            </div>
            <h3>The gap</h3>
            <p>The gap is the AI score minus the search score.</p>
            <ul>
              <li><strong>AI ahead:</strong> the gap is 30 or more.</li>
              <li><strong>Google ahead:</strong> the gap is -30 or less.</li>
              <li><strong>Strong in both:</strong> otherwise, both scores are 55 or more.</li>
              <li><strong>Invisible in both:</strong> otherwise, both scores are 15 or less.</li>
              <li><strong>Even:</strong> anything else.</li>
              <li><strong>Not checked:</strong> Google hasn't been checked yet, or no engine has answered.</li>
            </ul>
          </section>

          <section id="glossary">
            <h2>Glossary</h2>
            <p class="kicker">The words you'll see around the app.</p>
            <dl class="metrics">
              <div class="metric"><dt>Prompt</dt><dd>A question your buyers ask, tracked in a project. It never names your brand, so the results show whether Google and AI bring you up on their own.</dd></div>
              <div class="metric"><dt>Engine</dt><dd>One AI assistant Cansee asks: ChatGPT, Claude, Gemini, Grok or Perplexity.</dd></div>
              <div class="metric"><dt>AI visibility</dt><dd>The share of recent AI answers that name you.</dd></div>
              <div class="metric"><dt>Gap</dt><dd>Your AI score minus your search score for a prompt.</dd></div>
              <div class="metric"><dt>Retrieval</dt><dd>One time an AI engine pulled up a page while answering a prompt. One answer can retrieve many pages.</dd></div>
              <div class="metric"><dt>Citation rate</dt><dd>Of the times a page was retrieved, how often the answer cited it.</dd></div>
              <div class="metric"><dt>Brand alignment</dt><dd>How closely one answer reflects your brand facts, scored out of 100.</dd></div>
              <div class="metric"><dt>SEO</dt><dd>Search engine optimization: work that improves where Google ranks your pages.</dd></div>
              <div class="metric"><dt>GEO</dt><dd>Generative engine optimization: work that improves whether and how AI engines mention you.</dd></div>
            </dl>
          </section>

          <section id="contact">
            <h2>Contact</h2>
            <p class="kicker">When the docs don't cover it.</p>
            <p>Questions about your account, a prompt that looks wrong, or anything these docs don't answer: email us.</p>
            <div class="contact-card">
              <a class="email" :href="supportHref">{{ SUPPORT_EMAIL }}</a>
              <p class="contact-sub">Addresses for sales, privacy and security are on the <router-link to="/contact">contact page</router-link>.</p>
            </div>
          </section>
        </div>
      </main>

      <!-- FAQ rail -->
      <aside class="dx-rail">
        <h2 class="dx-rail-t">Frequently asked</h2>
        <details v-for="f in faqs" :key="f.id" class="faq">
          <summary>{{ f.q }}<svg class="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></summary>
          <p v-for="(para, i) in f.a" :key="i">{{ para }}</p>
          <ul v-if="f.list.length" class="faq-ul">
            <li v-for="(line, i) in f.list" :key="i">{{ line }}</li>
          </ul>
        </details>
        <button type="button" class="dx-rail-all" aria-haspopup="dialog" @click="help.open()">All questions</button>
        <p class="dx-rail-help">Still stuck? Email <a :href="supportHref">{{ SUPPORT_EMAIL }}</a>.</p>
      </aside>
    </div>

    <HelpDrawer />
  </div>
</template>

<style scoped>
.docs {
  background: var(--background);
  color: var(--foreground);
  min-height: 100vh;
  font-size: 14px;
  line-height: 1.62;
}
.docs a { color: var(--foreground); text-decoration: none; }

/* Top bar */
.dx-top {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 14px;
  height: 54px; padding: 0 18px;
  background: var(--background);
  border-bottom: 1px solid var(--border);
}
.dx-brand { display: flex; align-items: baseline; gap: 7px; flex-shrink: 0; }
.dx-mark { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: var(--foreground); }
.dx-tag { font-size: 10px; letter-spacing: .16em; font-family: var(--font-mono);  text-transform: uppercase; color: var(--muted-foreground); }
.dx-spacer { flex: 1; }
.dx-link { font-size: 12.5px; color: var(--muted-foreground); padding: 6px 10px; border-radius: var(--radius); }
.dx-link:hover { color: var(--foreground); background: var(--muted); }
/* Two classes: `.docs a` outranks one, and painted the label in
   --foreground on the dark button. */
.docs .dx-cta { font-size: 12.5px; font-weight: 600; color: var(--primary-foreground); background: var(--primary); padding: 6px 13px; border-radius: var(--radius); flex-shrink: 0; }
.dx-cta:hover { opacity: .9; }

.dx-search { position: relative; width: min(400px, 40vw); flex-shrink: 1; }
.dx-search-input { width: 100%; height: 34px; padding: 0 12px 0 33px; background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font: inherit; font-size: 13px; outline: none; }
.dx-search-input::placeholder { color: var(--muted-foreground); }
.dx-search-input:focus { border-color: var(--muted-foreground); }
.dx-search-ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted-foreground); pointer-events: none; }
.dx-kbd { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-size: 10.5px; color: var(--muted-foreground); border: 1px solid var(--border); border-radius: var(--radius); padding: 1px 6px; pointer-events: none; }
.dx-results { position: absolute; top: 42px; left: 0; right: 0; z-index: 60; background: var(--background); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: none; padding: 6px; max-height: 60vh; overflow-y: auto; }
.dx-sr { display: flex; flex-direction: column; width: 100%; text-align: left; padding: 8px 11px; border-radius: var(--radius); background: none; border: 0; cursor: pointer; }
.dx-sr.sel { background: var(--muted); }
.dx-sr-t { font-size: 13px; font-weight: 600; color: var(--foreground); }
.dx-sr-s { font-size: 11.5px; color: var(--muted-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dx-sr-empty { padding: 12px; font-size: 12.5px; color: var(--muted-foreground); margin: 0; }

/* Layout */
.dx-shell { display: grid; grid-template-columns: 236px minmax(0,1fr) 272px; max-width: 1500px; margin: 0 auto; }
.dx-side { position: sticky; top: 54px; align-self: start; height: calc(100vh - 54px); overflow-y: auto; padding: 22px 16px 60px; border-right: 1px solid var(--border); }
.dx-grp { margin-bottom: 18px; }
.dx-grp-t { font-size: 10px; font-weight: 500; letter-spacing: .13em; font-family: var(--font-mono);  text-transform: uppercase; color: var(--muted-foreground); margin: 0 0 6px; padding-left: 9px; }
.dx-navlink { display: block; font-size: 12.5px; color: var(--muted-foreground); padding: 4px 10px; border-radius: var(--radius); cursor: pointer; }
.dx-navlink:hover { color: var(--foreground); background: var(--muted); }
.dx-navlink.active { color: var(--foreground); font-weight: 600; background: var(--muted); box-shadow: inset 2px 0 0 var(--primary); }

.dx-main { min-width: 0; padding: 0 clamp(18px, 3.4vw, 52px); }
.dx-inner { max-width: 830px; margin: 0 auto; padding-bottom: 90px; }
.dx-crumb { padding: 22px 0 0; font-size: 11.5px; color: var(--muted-foreground); }
.dx-crumb strong { color: var(--foreground); font-weight: 600; }

.docs h1 { font-size: 27px; font-weight: 700; letter-spacing: -0.015em; color: var(--foreground); margin: 12px 0 10px; line-height: 1.12; }
.docs .lede { font-size: 15.5px; color: var(--foreground); margin: 0 0 8px; max-width: 70ch; line-height: 1.55; opacity: .9; }
.dx-hero { padding-bottom: 22px; border-bottom: 1px solid var(--border); }

.docs section { scroll-margin-top: 66px; padding-top: 34px; }
.docs h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--foreground); margin: 0 0 3px; }
.docs .kicker { color: var(--muted-foreground); font-size: 12.5px; margin: 0 0 14px; }
.docs h3 { font-size: 13.5px; font-weight: 700; color: var(--foreground); margin: 20px 0 6px; }
.docs p { margin: 0 0 12px; }
.prose > p, .prose > ul, .prose > ol { max-width: 76ch; }
.docs ul, .docs ol { padding-left: 19px; margin: 0 0 12px; }
.docs li { margin: 0 0 6px; }
.docs strong { color: var(--foreground); font-weight: 600; }

ol.steps { list-style: none; counter-reset: s; padding: 0; margin: 14px 0 0; }
ol.steps > li { counter-increment: s; position: relative; padding: 0 0 16px 38px; }
ol.steps > li::before { content: counter(s); position: absolute; left: 0; top: -1px; width: 24px; height: 24px; display: grid; place-items: center; font-size: 11.5px; font-weight: 700; color: var(--foreground); background: var(--card); border: 1px solid var(--border); border-radius: 50%; }
ol.steps > li::after { content: ""; position: absolute; left: 12px; top: 25px; bottom: 1px; width: 1px; background: var(--border); }
ol.steps > li:last-child::after { display: none; }

.note { border: 1px solid var(--border); background: var(--card); border-radius: var(--radius); padding: 12px 15px; margin: 15px 0; font-size: 13px; }
.note-label { display: inline-block; font-size: 9.5px; font-weight: 500; letter-spacing: .1em; font-family: var(--font-mono);  text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 4px; }
.note p:last-child { margin-bottom: 0; }

.service { border-top: 1px solid var(--border); padding: 20px 0 4px; scroll-margin-top: 66px; }
.service:first-of-type { border-top: 0; }
.svc-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 5px; }
.svc-head h3 { margin: 0; font-size: 16px; }
.svc-where { font-size: 11px; color: var(--muted-foreground); font-family: ui-monospace, monospace; }
.service p { margin: 0 0 9px; max-width: 74ch; }
.need { display: flex; gap: 9px; align-items: baseline; font-size: 12.5px; color: var(--muted-foreground); margin: 6px 0 12px; padding: 8px 12px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); max-width: 74ch; }
.need-l { font-size: 9.5px; font-weight: 500; letter-spacing: .09em; font-family: var(--font-mono);  text-transform: uppercase; color: var(--foreground); flex-shrink: 0; padding-top: 1px; }

.table-wrap { overflow-x: auto; margin: 14px 0; border: 1px solid var(--border); border-radius: var(--radius); }
.docs table { border-collapse: collapse; width: 100%; font-size: 13px; }
.docs th, .docs td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
.docs th { font-size: 10px; letter-spacing: .07em; font-family: var(--font-mono);  text-transform: uppercase; color: var(--muted-foreground); font-weight: 500; background: var(--card); }
.docs tr:last-child td { border-bottom: 0; }
.docs td:first-child, .docs th:first-child { font-weight: 600; color: var(--foreground); }

.metrics { display: grid; margin: 16px 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.metric { display: grid; grid-template-columns: 148px 1fr; gap: 14px; padding: 12px 15px; }
.metric + .metric { border-top: 1px solid var(--border); }
.metric dt { font-weight: 600; color: var(--foreground); font-size: 13px; }
.metric dd { margin: 0; color: var(--foreground); opacity: .88; font-size: 13px; }

.contact-card { border: 1px solid var(--border); background: var(--card); border-radius: var(--radius); padding: 18px 20px; margin-top: 14px; }
.contact-card .email { font-size: 16px; font-weight: 600; color: var(--foreground); }
.contact-card .email:hover { text-decoration: underline; }
.contact-sub { margin: 6px 0 0; color: var(--muted-foreground); font-size: 12.5px; }
.contact-sub a { text-decoration: underline; text-underline-offset: 2px; }

/* FAQ rail */
.dx-rail { position: sticky; top: 54px; align-self: start; height: calc(100vh - 54px); overflow-y: auto; padding: 26px 22px 60px; border-left: 1px solid var(--border); }
.docs .dx-rail-t { font-size: 10.5px; line-height: 1.4; letter-spacing: .12em; font-weight: 500; font-family: var(--font-mono);  text-transform: uppercase; color: var(--muted-foreground); margin: 0 0 12px; }
details.faq { border-bottom: 1px solid var(--border); padding: 9px 0; }
details.faq > summary { list-style: none; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--foreground); display: flex; gap: 8px; align-items: flex-start; }
details.faq > summary::-webkit-details-marker { display: none; }
details.faq > summary .chev { margin-left: auto; flex-shrink: 0; color: var(--muted-foreground); transition: transform .18s; margin-top: 3px; }
details.faq[open] > summary .chev { transform: rotate(90deg); }
details.faq p { margin: 7px 0 2px; font-size: 12px; color: var(--muted-foreground); line-height: 1.5; }
details.faq .faq-ul { margin: 4px 0 2px; padding-left: 16px; font-size: 12px; color: var(--muted-foreground); line-height: 1.5; }
.dx-rail-all { margin-top: 14px; padding: 6px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: none; color: var(--foreground); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.dx-rail-all:hover { background: var(--muted); }
.dx-rail-help { margin-top: 20px; font-size: 12px; color: var(--muted-foreground); }
.dx-rail-help a { color: var(--foreground); text-decoration: underline; text-underline-offset: 2px; }

.dx-menu { display: none; }
/* The mobile scrim must never be a grid item on desktop, or it eats the
   middle column and squeezes the content. Only the mobile query shows it. */
.dx-scrim { display: none; }
@media (max-width: 1120px) {
  .dx-shell { grid-template-columns: 220px minmax(0,1fr); }
  .dx-rail { display: none; }
}
@media (max-width: 820px) {
  .dx-shell { grid-template-columns: 1fr; }
  .dx-search { width: auto; flex: 1; }
  .hide-sm { display: none; }
  .dx-side { position: fixed; inset: 54px auto 0 0; width: 260px; z-index: 40; background: var(--background); transform: translateX(-100%); transition: transform .22s; box-shadow: none; }
  .dx-side.open { transform: none; }
  .dx-menu { display: inline-flex; align-items: center; width: 34px; height: 30px; justify-content: center; border: 1px solid var(--border); border-radius: var(--radius); background: none; color: var(--foreground); cursor: pointer; }
  .dx-scrim { display: none; position: fixed; inset: 54px 0 0 0; background: var(--scrim); z-index: 39; }
  .dx-scrim.open { display: block; }
}
@media (prefers-reduced-motion: reduce) { .dx-side { transition: none; } }
</style>
