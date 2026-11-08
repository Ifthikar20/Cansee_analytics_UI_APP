// The help center's questions and answers: one list for the help drawer,
// the Support page and the Docs page. Plain data and pure helpers, no Vue,
// so the public pages can use it without the app shell.
//
// Each group is { id, title, items }. Each item is:
//   id        unique, stable (the help store and ?faq=<id> links use it)
//   q         the question
//   a         the answer: one paragraph, or an array of paragraphs
//   list      optional bullet points shown after the answer
//   tags      extra search words
//   docs      optional anchor on /docs (a section id) for "Read more in Docs"
//   featured  optional list of places that show it on their own:
//             'support' (the Support page) and 'docs' (the Docs page rail)
//
// Answers are text only (never HTML) and describe what the app does today.
// Leave a fact out rather than guess it.

const item = (id, q, a, { list = [], tags = [], docs = null, featured = [] } = {}) =>
    Object.freeze({
        id,
        q,
        a: Object.freeze(Array.isArray(a) ? [...a] : [a]),
        list: Object.freeze([...list]),
        tags: Object.freeze([...tags]),
        docs,
        featured: Object.freeze([...featured]),
    })

const group = (id, title, items) => Object.freeze({ id, title, items: Object.freeze(items) })

export const FAQ_GROUPS = Object.freeze([
    group('getting-started', 'Getting started', [
        item(
            'gs-what',
            'What does Cansee do?',
            'For each buyer question you track, Cansee checks where your site ranks on Google and asks the AI engines (ChatGPT, Claude, Gemini, Grok and Perplexity) the same question. It then shows where Google and the AI answers disagree about you, and what to change.',
            { tags: ['overview', 'about'], docs: 'welcome' },
        ),
        item(
            'gs-setup',
            'How do I set up my first project?',
            'Setup has five steps: your website, your brand, competitors, prompts, and a first research run. Cansee reads your homepage to draft your description, competitors and starter prompts. You can change all of it later.',
            { tags: ['onboarding', 'start', 'new project'], docs: 'quickstart' },
        ),
        item(
            'gs-edit-setup',
            'The setup scan got my business details wrong.',
            'Everything from setup can be changed afterwards. Edit your description and competitors in Settings > Project. Add or archive prompts on the Analytics board, in Prompts or Prompt ranking.',
            { tags: ['onboarding', 'wrong', 'edit', 'description'], docs: 'project', featured: ['support'] },
        ),
        item(
            'gs-board',
            'How do I change what is on my Analytics board?',
            'The board starts with Ask AI, Prompt ranking, Summary, Citations and Who AI recommends. Use Add widget to add Prompts, Countries, Traffic and more. Drag a card by its top to move it, or use its menu to resize or remove it. Open a card\'s title, or choose Expand, to see its detail in a side panel. Your layout is saved.',
            { tags: ['widget', 'dashboard', 'layout', 'analytics'], docs: 'overview' },
        ),
        item(
            'gs-projects',
            'How do I switch or add projects?',
            'Use the project chip next to the logo. The Free plan includes 1 project, the 100 and 200 prompt plans include 5, and Business has no project limit.',
            { tags: ['brand', 'website', 'switch'] },
        ),
        item(
            'gs-traffic',
            'Do I need site traffic or an install?',
            'No. Prompts, Google checks and AI answers work without any install. The Traffic, AI traffic and AI crawlers widgets need a source, which you connect in Settings > Connections:',
            {
                list: [
                    'The Cansee pixel counts visitors, including visits from AI assistants.',
                    'Google Analytics 4.',
                    'Cloudflare counts requests rather than visitors, and is the only source that sees AI crawlers.',
                ],
                tags: ['pixel', 'analytics', 'ga4', 'cloudflare', 'install'],
                docs: 'connections',
                featured: ['docs'],
            },
        ),
    ]),
    group('prompts', 'Prompts and tracking', [
        item(
            'pr-what',
            'What is a prompt? Should it include my brand name?',
            'A prompt is a question your buyers ask. Leave your brand name out, so the results show whether Google and the AI engines bring you up on their own.',
            { tags: ['question', 'brand name'], docs: 'glossary', featured: ['docs'] },
        ),
        item(
            'pr-add',
            'How do I add prompts?',
            'On the Analytics board, open Prompts or Prompt ranking and choose Add prompts. Enter one question per line and pick the country to search from. The AI engines are asked right away.',
            { tags: ['new prompt', 'track'], docs: 'quickstart' },
        ),
        item(
            'pr-limit',
            'How many prompts can I track?',
            'The limit covers active prompts across all your projects. At the limit, archive some prompts or move to a bigger plan.',
            {
                list: ['Free: 5', '100 prompts plan: 100', '200 prompts plan: 200', 'Business: no limit'],
                tags: ['limit', 'tracked prompts', 'how many'],
                docs: 'billing',
            },
        ),
        item(
            'pr-often',
            'How often are prompts checked?',
            'Whenever you choose Check now, and on the daily, weekly or monthly schedule you set for each prompt. On the 100 and 200 prompt plans, Autopilot can also ask every tracked prompt once a day.',
            { tags: ['schedule', 'frequency', 'check now', 'daily'], docs: 'prompt', featured: ['docs'] },
        ),
        item(
            'pr-askai',
            'What is Ask AI?',
            [
                'Ask AI sends one question to each engine several times (3 by default, up to 10) and shows how often you are named and at what rank. It shows what the run will use before it starts. Its answers are not added to your tracked numbers; choose Track to keep checking the question.',
                'On the Free plan, every engine answer from Ask AI counts as one prompt run.',
            ],
            { tags: ['prompt box', 'ask', 'samples'], docs: 'ask-ai' },
        ),
        item(
            'pr-ranked',
            'Why is a prompt not ranked in Prompt ranking yet?',
            'A prompt is ranked once it has enough recent answers. The card says how many prompts are still waiting.',
            { tags: ['ranking', 'waiting', 'unranked'] },
        ),
        item(
            'pr-country',
            'Can I check results for a specific country?',
            'Yes. Each prompt has a country. The Countries widget shows Google and the AI engines country by country, and can run a prompt in more countries.',
            { tags: ['location', 'region', 'geo'] },
        ),
        item(
            'pr-archive',
            'What does Archive do?',
            'Archiving stops the prompt from running and removes it from Prompts. Re-adding an archived prompt counts against your tracked-prompt limit again.',
            { tags: ['delete', 'remove', 'stop'], docs: 'prompt' },
        ),
        item(
            'pr-competitors',
            'Who counts as a competitor?',
            'The brands you list in Settings > Project: up to 25, each a name and a domain. The Who AI recommends widget shows every brand the answers name, including ones you have not listed.',
            { tags: ['competition', 'rivals', 'brands'], docs: 'project', featured: ['docs'] },
        ),
    ]),
    group('gap', 'Google vs AI gap', [
        item(
            'gap-score',
            'How is the gap scored?',
            [
                'Each prompt gets two scores out of 100. The search score comes from your Google position: #1-3 is 100, #4-10 is 80, #11-20 is 55, #21-50 is 30, #51-100 is 15, and not found is 0.',
                'The AI score, per engine, is the share of its last 5 answers that name you, multiplied by the average weight of those mentions (#1-3 is 100, #4-5 is 80, #6-10 is 55, #11 or lower is 30, named without a rank is 55). The prompt\'s AI score is the average over the engines that answered. The gap is the AI score minus the search score.',
            ],
            { tags: ['score', 'formula', 'calculation'], docs: 'scoring' },
        ),
        item(
            'gap-labels',
            'What do AI ahead, Google ahead, Strong in both, Invisible in both and Even mean?',
            'They describe the gap between the two scores:',
            {
                list: [
                    'AI ahead: the gap is +30 or more.',
                    'Google ahead: the gap is -30 or less.',
                    'Strong in both: otherwise, both scores are 55 or more.',
                    'Invisible in both: otherwise, both scores are 15 or less.',
                    'Even: anything else.',
                ],
                tags: ['labels', 'class', 'verdict'],
                docs: 'scoring',
            },
        ),
        item(
            'gap-notchecked',
            'Why does a prompt say Not checked?',
            'Google has not been checked for it yet, or no engine has answered. An unchecked Google result is treated as no data, never as not ranking. Use Check Google in Prompts, or Check now on the prompt.',
            { tags: ['not checked', 'missing', 'no data'], docs: 'scoring', featured: ['docs'] },
        ),
        item(
            'gap-aio',
            'What is the AI Overview line on a prompt?',
            'The Google check also records whether Google showed an AI Overview, and whether it mentions or cites you. Not measured means Cansee could not tell; it does not mean no.',
            { tags: ['ai overview', 'google ai', 'aio'], docs: 'engines' },
        ),
        item(
            'gap-citations',
            'What do retrievals and citation rate mean?',
            'A retrieval is one time an engine pulled up a page while answering. Citation rate is how often the answer cited a page it retrieved. The Citations widget groups pages into yours, competitors\' and third parties\'.',
            { tags: ['sources', 'citations', 'urls'], docs: 'sources' },
        ),
        item(
            'gap-change',
            'Can Cansee change what an AI engine says about me?',
            'No tool can retrain the public models from outside. Brand facts let Cansee check answers against what is true, which drives the brand alignment score and the Fact check and What AI gets wrong lists. Cansee shows which pages to work on.',
            { tags: ['brand facts', 'fix', 'wrong answer'], docs: 'brand-facts', featured: ['docs'] },
        ),
    ]),
    group('engines', 'AI engines', [
        item(
            'eng-which',
            'Which AI engines does Cansee ask?',
            'ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google), Grok (xAI) and Perplexity. Perplexity answers from the live web. The Google check also shows whether Google displayed an AI Overview for the prompt.',
            { tags: ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'models'], docs: 'engines', featured: ['docs'] },
        ),
        item(
            'eng-keys',
            'Do I need my own API keys?',
            'No. Cansee asks the engines itself; there is nowhere to enter your own keys.',
            { tags: ['api key', 'openai key', 'byok'] },
        ),
        item(
            'eng-missing',
            'Why is an engine, or Google, not available?',
            'That engine, or the Google search provider, is not set up on this workspace, and the screen says so, for example "ChatGPT isn\'t set up on this workspace". Cansee skips an engine that is not set up; it never fills in an answer for it.',
            { tags: ['unavailable', 'not set up', 'missing engine'], docs: 'engines' },
        ),
        item(
            'eng-vary',
            'Why do answers change from run to run?',
            'AI answers vary each time. Each engine\'s score uses its last 5 answers, to smooth out one-off answers, and Ask AI asks several times for the same reason.',
            { tags: ['different', 'inconsistent', 'random'] },
        ),
    ]),
    group('agent', 'Agent and research', [
        item(
            'ag-what',
            'What can the Agent do?',
            'The Agent researches your rankings and writes drafts in a chat. The general agents (Gap Analyst, Landing page, AEO article, Ad campaign) start a chat. The specialists (Page Optimizer, Comparison page, Social posts, PR, llms.txt, Messaging brief) ask for their inputs first, then draft the task into a new chat for you to send.',
            { tags: ['ai agent', 'chat', 'agents'], docs: 'agent' },
        ),
        item(
            'ag-research',
            'What are research agents?',
            'In a chat, the Agent can plan research across five areas: Google (SEO), AI engines (GEO), competitor pages, your site and content gaps, and sources and citations. The results come back as a table you can re-run. Research runs are private to you. On the Free plan, each AI engine answer a research run asks for counts as one prompt run.',
            { tags: ['swarm', 'research table', 'parallel'], docs: 'research' },
        ),
        item(
            'ag-findings',
            'What are Findings, and who sees them?',
            'Findings are the issues and opportunities from research, shared with everyone on the project. Add them from a research table or by hand, then mark them done or dismissed. Viewers can read them but not change them.',
            { tags: ['issues', 'opportunities', 'tasks'], docs: 'findings' },
        ),
        item(
            'ag-context',
            'What is Context?',
            'Context is what the agents know about your project, in sections with their sources, plus documents you add. Build from my site suggests entries for you to accept; the agents use active entries only.',
            { tags: ['knowledge', 'documents', 'memory'], docs: 'agent' },
        ),
        item(
            'ag-reviews',
            'How do reviews and approvals work?',
            'You can ask a teammate to review a draft. An approval records who approved which version and publishes nothing. A newer version needs a new approval.',
            { tags: ['approve', 'review', 'teammate'], docs: 'agent' },
        ),
        item(
            'ag-notready',
            'The Agent says it cannot run. What now?',
            'The Agent says why it cannot run:',
            {
                list: [
                    'Not set up: the Agent is not set up on this workspace. Contact support.',
                    'Sending faster than the Agent can take them: wait a few seconds and try again.',
                    'Allowance used: on the Free plan, the Agent pauses until the allowance resets next month, or until you upgrade.',
                ],
                tags: ['error', 'busy', 'not set up', 'quota'],
                docs: 'agent',
            },
        ),
    ]),
    group('reports', 'Reports', [
        item(
            'rep-where',
            'Where are my reports?',
            'Under Agent > Reports. The Gap Analyst writes reports. Other drafts are under Documents (pages and documents) and Sheets (ad campaigns).',
            { tags: ['reports', 'documents', 'sheets', 'drafts'], docs: 'reports' },
        ),
        item(
            'rep-templates',
            'Can I choose a report template?',
            'Yes. There are seven templates: Executive summary, Google vs AI gap, Competitor comparison, Prompt deep dive, Sources and citations, Brand accuracy, and Change log since the last run. Pick one when you start a report, or for the next reply in a chat. Reports cannot be scheduled, and you cannot make your own templates.',
            { tags: ['template', 'layout', 'format'], docs: 'reports' },
        ),
        item(
            'rep-export',
            'How do I export a report?',
            'Use Export once the draft is finished:',
            {
                list: [
                    'Reports and documents: Markdown, HTML, or Print or save as PDF.',
                    'Sheets: CSV, TSV, or Copy as table.',
                    'Landing pages: Download or Copy HTML.',
                    'llms.txt drafts: a download of the file.',
                ],
                tags: ['export', 'pdf', 'download', 'csv', 'markdown'],
                docs: 'reports',
            },
        ),
        item(
            'rep-channels',
            'Can results be sent to Slack, Teams or Discord?',
            'Yes. Connect a Slack, Discord or Microsoft Teams channel with a webhook in Settings > Connections, under Where reports go.',
            { tags: ['slack', 'teams', 'discord', 'webhook', 'notifications'], docs: 'connections' },
        ),
    ]),
    group('plans', 'Plans and prompt runs', [
        item(
            'plan-free',
            'What does the Free plan include?',
            'The Free plan includes:',
            {
                list: [
                    '20 prompt runs a month. One run is one prompt answered by one AI engine, so one prompt asked to all five engines uses 5 runs.',
                    'The runs are shared by all your projects and all engines, and reset at the start of each month.',
                    'Every engine answer counts: scheduled checks, Check now, Ask AI, Autopilot, research agents and your first research.',
                    'Only a successful answer counts. An engine that fails or is not set up uses no run.',
                    '1 project and up to 5 tracked prompts.',
                ],
                tags: ['free', 'prompt runs', 'allowance', 'limit', 'quota', 'price'],
                docs: 'billing',
                featured: ['support'],
            },
        ),
        item(
            'plan-out',
            'What happens when I run out of prompt runs?',
            'New checks are refused until the runs reset at the start of next month, or until you move to a paid plan. Your existing results stay.',
            { tags: ['used up', 'limit reached', 'quota', 'exhausted'], docs: 'billing' },
        ),
        item(
            'plan-paid',
            'What do the paid plans include, and how do I change or cancel?',
            'Upgrade through the secure checkout. In Settings > Subscription, use Manage billing to change plans, update your card, see invoices, or cancel or resume.',
            {
                list: [
                    '100 prompts ($80 a month) and 200 prompts ($140 a month): up to 5 projects and Autopilot, with no free trial.',
                    'Business: custom pricing, team seats and single sign-on. Contact sales.',
                ],
                tags: ['upgrade', 'cancel', 'subscription', 'invoice', 'pricing', 'billing'],
                docs: 'billing',
                featured: ['support'],
            },
        ),
        item(
            'ts-paid',
            'I paid, but I still see the plans screen.',
            'Choose your plan again. Cansee checks the payment provider\'s records, and if your subscription is already active it says so and takes you to the dashboard. If that does not work, email support with the date of the charge.',
            { tags: ['paywall', 'payment', 'stuck', 'charged'], featured: ['support'] },
        ),
    ]),
    group('account', 'Account and team', [
        item(
            'acct-roles',
            'How do team roles work?',
            'Organization accounts have an Owner, Admins, Members and Viewers. Admins invite people by email; only the owner can make or remove an Admin. A pending invite takes up a seat until it is accepted or expires.',
            { tags: ['team', 'invite', 'viewer', 'admin', 'seats'], docs: 'team' },
        ),
        item(
            'acct-sso',
            'Can we require company sign-in?',
            'Yes, on organization accounts. Admins can verify your email domain in Settings > Domains & SSO and require single sign-on for everyone. Password sign-in is then refused.',
            { tags: ['sso', 'domain', 'login', 'security'], docs: 'team' },
        ),
        item('acct-delete', 'How do I delete my account?', 'In Settings > Account, choose Delete account.', {
            tags: ['remove account', 'close account'],
        }),
    ]),
    group('troubleshooting', 'Troubleshooting', [
        item(
            'ts-autopilot',
            'Autopilot says it is paused.',
            'Autopilot pauses after 3 failed runs in a row. Check the last run in Settings > Autopilot, then turn it back on.',
            { tags: ['autopilot', 'paused', 'failed'], docs: 'autopilot' },
        ),
        item(
            'ts-load',
            'A card says it could not load, or that a feature is turned off.',
            'Use Try again on the card. Turned off on this server means that feature is turned off on this installation; contact support.',
            { tags: ['error', 'failed', 'load'] },
        ),
        item(
            'ts-contact',
            'How do I reach a person?',
            'Email support from the address on your account. For a refund, include the date of the charge.',
            { tags: ['contact', 'email', 'human', 'support'], docs: 'contact' },
        ),
    ]),
])

const ALL = Object.freeze(FAQ_GROUPS.flatMap((g) => g.items.map((it) => Object.freeze({ ...it, group: g.id }))))
const BY_ID = new Map(ALL.map((it) => [it.id, it]))

/** Every item, in display order, each with its group id. */
export function allFaqs() {
    return ALL
}

/** The item with this id, or null. */
export function faqById(id) {
    return BY_ID.get(String(id ?? '')) || null
}

/** The items a place shows on its own ('support' or 'docs'), in display order. */
export function featuredFaqs(where) {
    return ALL.filter((it) => it.featured.includes(where))
}

const haystack = (it) => [it.q, ...it.a, ...it.list, ...it.tags].join(' ').toLowerCase()
const HAYSTACKS = new Map(ALL.map((it) => [it.id, haystack(it)]))

/**
 * The items that contain every word of the query (case-insensitive) in the
 * question, the answer, the bullets or the tags. An empty query matches none.
 */
export function searchFaq(query) {
    const words = String(query ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
    if (!words.length) return []
    return ALL.filter((it) => {
        const text = HAYSTACKS.get(it.id)
        return words.every((w) => text.includes(w))
    })
}
