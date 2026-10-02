// Sample data for the landing-page product tour.
//
// Meterlane is a fictional brand; every figure here is illustrative and
// the tour labels it as such. The shapes, though, mirror what the product
// really produces, and the derived numbers are computed with the same
// formulas the backend uses (apps/llm_ranking/services/ranking_service.py):
// Beta(2, 8)-smoothed mention rate, Wilson 95% interval on the raw rate,
// and the 40/30/20/10 visibility score. Plain ESM with no `@/` imports so
// `node --test` can load it directly.

export const TOUR_BRAND = {
  name: 'Meterlane',
  domain: 'meterlane.com',
  category: 'project tracking',
}

// Keys match the landing page's --v-* model ramp.
export const TOUR_ENGINES = [
  { key: 'openai', label: 'ChatGPT' },
  { key: 'anthropic', label: 'Claude' },
  { key: 'google', label: 'Gemini' },
  { key: 'perplexity', label: 'Perplexity' },
]

export const TOUR_STEPS = [
  {
    key: 'ask',
    label: 'Ask',
    feature: 'Prompt Library',
    title: 'Start from a question buyers really ask.',
    caption:
      "Prompts come from Reddit threads, Google's People Also Ask and your own Search Console queries, so you are measured on real demand rather than guesswork.",
  },
  {
    key: 'answers',
    label: 'Answers',
    feature: 'Multi-LLM probing',
    title: 'Ask every engine. Keep every answer.',
    caption:
      'The same question runs on each engine several times. Every answer is stored word for word with its citations, and your brand and your competitors are picked out of the text.',
  },
  {
    key: 'score',
    label: 'Score',
    feature: 'AI visibility score',
    title: 'One score, with the error bars shown.',
    caption:
      'Mention rate, position, sentiment and engine coverage roll up into a 0–100 score. The mention rate carries a 95% confidence range, so one lucky run is not mistaken for progress.',
  },
  {
    key: 'sources',
    label: 'Sources',
    feature: 'Source Influence · Brand Research',
    title: 'See why the AI said it.',
    caption:
      'Every citation behind every answer, ranked by domain, with whether you appear there. Brand Research finds the live threads the engines are reading.',
  },
  {
    key: 'risks',
    label: 'Risks',
    feature: 'Brand Security · Brand facts',
    title: 'Catch what AI gets wrong about you.',
    caption:
      'Nine checks read every answer for negative, false or unfavourable claims and quote the exact sentence. Your own brand facts show what the engines miss or contradict.',
  },
  {
    key: 'act',
    label: 'Act',
    feature: 'Opportunities · Digests',
    title: 'Know what to fix next.',
    caption:
      'Cited pages are joined to your Google rankings and AI-referred visits, then turned into a short list. The summary lands in Slack, Discord or Teams.',
  },
]

// The nine Brand Security detectors, by stable code.
export const TOUR_DETECTORS = {
  'BS-SENT-001': 'Negative sentiment',
  'BS-SENT-002': 'Weak endorsement',
  'BS-LANG-001': 'Derogatory language',
  'BS-HARM-001': 'Harmful association',
  'BS-COMP-001': 'Unfavourable comparison',
  'BS-FACT-001': 'Factual misrepresentation',
  'BS-IMP-001': 'Impersonation',
  'BS-TRST-001': 'Distrust signals',
  'BS-PRIV-001': 'Private data exposure',
}

export const TOUR_SEVERITIES = ['high', 'medium', 'low']

// The three opportunity buckets the backend builds
// (apps/citations/services/url_opportunities.py), with the labels the
// rest of the landing page already uses for them.
export const TOUR_ACTION_KINDS = {
  seo_gap: 'AI cites you, Google buries you',
  content_gap: 'AI answers skip your brand',
  winning: 'Working well',
}

export const TOUR_FACT_STATUSES = {
  reflected: 'Reflected',
  missed: 'Missed',
  contradicted: 'Contradicted',
}

export const TOUR_PRESENCE = {
  own: 'Your site',
  mentioned: 'You are mentioned',
  absent: 'You are not mentioned',
}

export const TOUR_PROMPTS = [
  {
    id: 'startup',
    text: 'best project tracker for a 10-person startup',
    intent: 'Comparison',
    group: 'Category',
    foundOn: ['Reddit · r/startups', 'Google · People also ask', 'Your Search Console queries'],
    // Per engine: answers collected, the rank of each answer that
    // mentioned you, and the sentiment of those mentions.
    runs: {
      openai: { answers: 6, ranks: [3, 2, 3, 4], sentiment: { positive: 3, neutral: 1, negative: 0 } },
      anthropic: { answers: 6, ranks: [2, 2, 1, 3, 2], sentiment: { positive: 4, neutral: 1, negative: 0 } },
      google: { answers: 6, ranks: [5, 4], sentiment: { positive: 1, neutral: 1, negative: 0 } },
      perplexity: { answers: 6, ranks: [1, 2, 2, 3], sentiment: { positive: 3, neutral: 0, negative: 1 } },
    },
    // The latest answer from each engine. [[brand]] marks your brand and
    // {{brand}} a competitor; see parseSegments().
    answers: {
      openai: {
        position: 3,
        sentiment: 'positive',
        capturedAt: '2 hours ago',
        cited: ['g2.com', 'zapier.com', 'reddit.com'],
        text:
          'For a team of ten, these are the strongest picks:\n1. {{Linear}}: fast and keyboard-first, ideal if most of the team writes code.\n2. {{Asana}}: flexible boards and timelines for mixed teams.\n3. [[Meterlane]]: simple sprint tracking, with a free plan that covers ten users.\n4. {{Trello}}: the lightest option if you only need a board.',
      },
      anthropic: {
        position: 2,
        sentiment: 'positive',
        capturedAt: '2 hours ago',
        cited: ['meterlane.com', 'linear.app', 'zapier.com'],
        text:
          'It depends on how technical the team is.\n1. {{Linear}} if engineering drives the roadmap.\n2. [[Meterlane]] if you want sprints and client-facing roadmaps in one place; its free plan fits ten people.\n3. {{Notion}} if documents matter more than tracking.\nI would trial the first two for a week each.',
      },
      google: {
        position: 5,
        sentiment: 'neutral',
        capturedAt: '3 hours ago',
        cited: ['zapier.com', 'linear.app'],
        text:
          'Popular choices for small startups include:\n1. {{Notion}}\n2. {{Asana}}\n3. {{Trello}}\n4. {{Linear}}\n5. [[Meterlane]]\nNotion and Asana have the largest template libraries, which helps teams that are still defining their process.',
      },
      perplexity: {
        position: 1,
        sentiment: 'positive',
        capturedAt: '1 hour ago',
        cited: ['reddit.com', 'g2.com', 'meterlane.com'],
        text:
          '[[Meterlane]] is the tracker most often recommended for teams under fifteen in recent startup threads, mainly for its free plan and simple sprint setup. {{Linear}} is the usual alternative for engineering-led teams, and {{Asana}} for teams that need timelines and approvals.',
      },
    },
    shareOfVoice: [
      { brand: 'Linear', pct: 29 },
      { brand: 'Meterlane', pct: 24, you: true },
      { brand: 'Asana', pct: 21 },
      { brand: 'Notion', pct: 14 },
      { brand: 'Others', pct: 12 },
    ],
    sources: [
      {
        domain: 'reddit.com',
        type: 'Community',
        share: 26,
        citedBy: ['perplexity', 'openai'],
        presence: 'mentioned',
        note: 'The main source for this question on Perplexity. The threads it cites recommend Linear nine times and Meterlane twice.',
      },
      {
        domain: 'zapier.com',
        type: 'Blog',
        share: 21,
        citedBy: ['openai', 'anthropic', 'google'],
        presence: 'absent',
        note: 'A "best project management apps" roundup that three engines lean on. It lists Linear and Asana, not you.',
      },
      {
        domain: 'g2.com',
        type: 'Review',
        share: 15,
        citedBy: ['openai', 'perplexity'],
        presence: 'mentioned',
        rank: 4,
        note: 'You place 4th in the category grid here, the cheapest position on this list to improve.',
      },
      {
        domain: 'linear.app',
        type: 'Competitor',
        share: 12,
        citedBy: ['anthropic', 'google'],
        presence: 'absent',
        note: "A competitor's own comparison page is shaping two engines' answers.",
      },
      {
        domain: 'meterlane.com',
        type: 'Your site',
        share: 9,
        citedBy: ['anthropic', 'perplexity'],
        presence: 'own',
        note: 'Your pricing and startup pages are cited, mostly by Claude.',
      },
    ],
    conversation: {
      domain: 'reddit.com',
      where: 'r/startups',
      age: '3 days ago',
      engine: 'perplexity',
      title: 'What are you using to track work at under 15 people?',
      quote: 'Linear if you are all engineers. We moved to Meterlane because the free plan covered everyone.',
      brands: [
        { brand: 'Linear', mentions: 9 },
        { brand: 'Asana', mentions: 5 },
        { brand: 'Meterlane', mentions: 2, you: true },
      ],
      note: 'Perplexity cited this thread in 4 of its 6 answers. A useful reply from your team here is the quickest way into that answer.',
    },
    risks: [
      {
        code: 'BS-COMP-001',
        engine: 'perplexity',
        severity: 'medium',
        before: 'Both are capable, though ',
        flagged: 'most teams end up choosing Linear over Meterlane',
        after: ' once they pass twenty people.',
      },
      {
        code: 'BS-SENT-002',
        engine: 'google',
        severity: 'low',
        before: 'Meterlane ',
        flagged: 'can work for very simple projects',
        after: ', and has a free plan.',
      },
    ],
    alignment: {
      score: 71,
      facts: [
        { fact: 'Free plan covers up to 10 users', status: 'reflected', engines: ['anthropic', 'perplexity', 'openai'] },
        { fact: 'Sprints and client roadmaps in one workspace', status: 'reflected', engines: ['anthropic'] },
        { fact: 'Two-way GitHub and GitLab sync', status: 'missed', engines: [] },
        {
          fact: 'Paid plans start at $8 per user',
          status: 'contradicted',
          engines: ['openai'],
          note: 'ChatGPT quotes $15 per user in 2 of 6 answers.',
        },
      ],
    },
    actions: [
      {
        kind: 'seo_gap',
        page: 'meterlane.com/startups',
        detail: 'Cited in 5 answers, but ranks #14 on Google for "startup project tracker".',
      },
      {
        kind: 'content_gap',
        page: 'zapier.com/blog/best-project-management-apps',
        detail: 'Cited by three engines. It lists Linear and Asana, not you. Pitch an update or publish a comparable roundup.',
      },
      {
        kind: 'winning',
        page: 'meterlane.com/pricing',
        detail: 'Cited by Claude and Perplexity, and earned 214 AI-referred visits in the last 30 days.',
      },
    ],
    digest: {
      channel: '#marketing',
      delta: 7,
      lines: [
        'Perplexity now ranks you #1. Gemini still lists you 5th.',
        'One new medium alert: unfavourable comparison on Perplexity.',
        'Top action: join the r/startups thread Perplexity keeps citing.',
      ],
    },
  },

  {
    id: 'versus',
    text: 'Meterlane vs Linear for a design-led team',
    intent: 'Versus',
    group: 'Competitor',
    foundOn: ['Google · People also ask', 'Reddit · r/userexperience', 'Your Search Console queries'],
    runs: {
      openai: { answers: 6, ranks: [2, 2, 1, 2, 2, 2], sentiment: { positive: 2, neutral: 4, negative: 0 } },
      anthropic: { answers: 6, ranks: [1, 1, 2, 1, 1, 1], sentiment: { positive: 5, neutral: 1, negative: 0 } },
      google: { answers: 6, ranks: [2, 2, 2, 1, 2], sentiment: { positive: 2, neutral: 2, negative: 1 } },
      perplexity: { answers: 6, ranks: [1, 1, 1, 2, 1, 1], sentiment: { positive: 5, neutral: 1, negative: 0 } },
    },
    answers: {
      openai: {
        position: 2,
        sentiment: 'neutral',
        capturedAt: '4 hours ago',
        cited: ['g2.com', 'linear.app'],
        text:
          'Both are solid. {{Linear}} is the stronger pick for engineering-heavy teams, thanks to its speed and Git integrations. [[Meterlane]] suits design-led teams better: Figma frames sit inside each task, and client reviewers can comment without a paid seat. If design review is your bottleneck, start with Meterlane.',
      },
      anthropic: {
        position: 1,
        sentiment: 'positive',
        capturedAt: '4 hours ago',
        cited: ['meterlane.com', 'figma.com'],
        text:
          '[[Meterlane]] is the better fit for a design-led team. Figma frames embed directly in tasks, and guests can review work for free. {{Linear}} is faster for pure engineering work but treats design as an attachment rather than part of the flow.',
      },
      google: {
        position: 2,
        sentiment: 'negative',
        capturedAt: '5 hours ago',
        cited: ['linear.app'],
        text:
          '{{Linear}} is generally preferred. [[Meterlane]] lacks native Figma support, so design files have to be linked manually, which slows reviews down.',
      },
      perplexity: {
        position: 1,
        sentiment: 'positive',
        capturedAt: '3 hours ago',
        cited: ['g2.com', 'reddit.com', 'meterlane.com'],
        text:
          'Reviewers on G2 and r/userexperience favour [[Meterlane]] for design teams, citing Figma embeds and free guest reviewers. {{Linear}} scores higher for issue-tracking speed.',
      },
    },
    shareOfVoice: [
      { brand: 'Meterlane', pct: 46, you: true },
      { brand: 'Linear', pct: 41 },
      { brand: 'Jira', pct: 7 },
      { brand: 'Others', pct: 6 },
    ],
    sources: [
      {
        domain: 'g2.com',
        type: 'Review',
        share: 24,
        citedBy: ['perplexity', 'openai'],
        presence: 'mentioned',
        rank: 2,
        note: 'The head-to-head comparison page. You lead on ease of use and trail on integrations.',
      },
      {
        domain: 'linear.app',
        type: 'Competitor',
        share: 19,
        citedBy: ['openai', 'google'],
        presence: 'mentioned',
        note: "Linear's own comparison page, and the source of Gemini's Figma claim.",
      },
      {
        domain: 'meterlane.com',
        type: 'Your site',
        share: 17,
        citedBy: ['anthropic', 'perplexity'],
        presence: 'own',
        note: 'Your design-teams page is cited by the two engines that rank you first.',
      },
      {
        domain: 'reddit.com',
        type: 'Community',
        share: 14,
        citedBy: ['perplexity'],
        presence: 'mentioned',
        rank: 1,
        note: 'You are the most-mentioned brand in the threads Perplexity cites.',
      },
      {
        domain: 'figma.com',
        type: 'Docs',
        share: 8,
        citedBy: ['anthropic'],
        presence: 'mentioned',
        note: "Figma's integrations directory lists you, and Claude uses it to confirm the embed.",
      },
    ],
    conversation: {
      domain: 'reddit.com',
      where: 'r/userexperience',
      age: '1 week ago',
      engine: 'perplexity',
      title: 'Design team moving off Jira: Linear or Meterlane?',
      quote: 'Meterlane, purely because reviewers can comment on Figma frames without a paid seat.',
      brands: [
        { brand: 'Meterlane', mentions: 7, you: true },
        { brand: 'Linear', mentions: 6 },
        { brand: 'Jira', mentions: 3 },
      ],
      note: 'You lead this thread and Perplexity quotes it. Keep the replies current as your pricing changes.',
    },
    risks: [
      {
        code: 'BS-FACT-001',
        engine: 'google',
        severity: 'medium',
        before: 'Linear is generally preferred. ',
        flagged: 'Meterlane lacks native Figma support',
        after: ', so design files have to be linked manually, which slows reviews down.',
      },
      {
        code: 'BS-COMP-001',
        engine: 'openai',
        severity: 'medium',
        before: 'For anything beyond design work, ',
        flagged: 'Linear is the more mature tool',
        after: '.',
      },
    ],
    alignment: {
      score: 64,
      facts: [
        { fact: 'Guest reviewers are free on every plan', status: 'reflected', engines: ['anthropic', 'openai', 'perplexity'] },
        {
          fact: 'Figma frames embed natively in every task',
          status: 'contradicted',
          engines: ['google'],
          note: 'Gemini says the integration does not exist. The other three engines get it right.',
        },
        { fact: 'Two-way GitHub and GitLab sync', status: 'missed', engines: [] },
        { fact: 'SOC 2 Type II certified', status: 'missed', engines: [] },
      ],
    },
    actions: [
      {
        kind: 'seo_gap',
        page: 'meterlane.com/compare/linear',
        detail: 'Cited in 9 answers, but ranks #11 on Google for "meterlane vs linear".',
      },
      {
        kind: 'content_gap',
        page: 'g2.com/compare/linear-vs-jira',
        detail: 'ChatGPT cites this comparison, which names Linear and Jira but not you. Ask G2 to add Meterlane to it.',
      },
      {
        kind: 'winning',
        page: 'meterlane.com/design-teams',
        detail: 'Cited by Claude and Perplexity, and earned 158 AI-referred visits in the last 30 days.',
      },
    ],
    digest: {
      channel: '#marketing',
      delta: 3,
      lines: [
        'Gemini still says you lack Figma support (factual misrepresentation, medium).',
        'Perplexity now cites r/userexperience, where you lead Linear 7 to 6.',
        'Top action: publish a sourced comparison page that shows the Figma embed.',
      ],
    },
  },

  {
    id: 'maintained',
    text: 'is Meterlane still maintained in 2026',
    intent: 'Question',
    group: 'Brand',
    foundOn: ['Your Search Console queries', 'Google · People also ask', 'Reddit · r/projectmanagement'],
    runs: {
      openai: { answers: 6, ranks: [1, 1, 1, 1, 1, 1], sentiment: { positive: 1, neutral: 2, negative: 3 } },
      anthropic: { answers: 6, ranks: [1, 1, 1, 1, 1, 1], sentiment: { positive: 4, neutral: 2, negative: 0 } },
      google: { answers: 6, ranks: [1, 1, 1, 1, 1, 1], sentiment: { positive: 2, neutral: 3, negative: 1 } },
      perplexity: { answers: 6, ranks: [1, 1, 1, 1, 1, 1], sentiment: { positive: 5, neutral: 1, negative: 0 } },
    },
    answers: {
      openai: {
        position: 1,
        sentiment: 'negative',
        capturedAt: '1 hour ago',
        cited: ['techcrunch.com'],
        text:
          'Worth checking before you commit. [[Meterlane]] was acquired in 2024 and is no longer actively maintained, so migration may become a concern. {{Asana}} or {{Linear}} are safer long-term choices.',
      },
      anthropic: {
        position: 1,
        sentiment: 'positive',
        capturedAt: '1 hour ago',
        cited: ['meterlane.com'],
        text:
          'Yes. [[Meterlane]] ships updates every two weeks, and its public changelog shows a release in September 2026. It remains independent.',
      },
      google: {
        position: 1,
        sentiment: 'neutral',
        capturedAt: '2 hours ago',
        cited: ['meterlane.com', 'g2.com'],
        text:
          '[[Meterlane]] appears to be active. Its website lists recent releases, though third-party reviews from 2024 mention slower support response times.',
      },
      perplexity: {
        position: 1,
        sentiment: 'positive',
        capturedAt: '30 minutes ago',
        cited: ['meterlane.com', 'reddit.com', 'github.com'],
        text:
          "Yes. [[Meterlane]]'s changelog and GitHub activity show regular releases through 2026, and a recent r/projectmanagement thread confirms the team still responds to bug reports.",
      },
    },
    shareOfVoice: [
      { brand: 'Meterlane', pct: 78, you: true },
      { brand: 'Asana', pct: 9 },
      { brand: 'Linear', pct: 8 },
      { brand: 'Others', pct: 5 },
    ],
    sources: [
      {
        domain: 'meterlane.com',
        type: 'Your site',
        share: 31,
        citedBy: ['anthropic', 'perplexity', 'google'],
        presence: 'own',
        note: 'Your changelog is the strongest proof that you are active. Three engines cite it.',
      },
      {
        domain: 'techcrunch.com',
        type: 'News',
        share: 18,
        citedBy: ['openai'],
        presence: 'mentioned',
        note: 'A 2024 article about an acquisition that never closed. ChatGPT repeats it as fact.',
      },
      {
        domain: 'reddit.com',
        type: 'Community',
        share: 16,
        citedBy: ['perplexity'],
        presence: 'mentioned',
        rank: 1,
        note: 'Recent threads correct the rumour, and Perplexity reads them.',
      },
      {
        domain: 'g2.com',
        type: 'Review',
        share: 12,
        citedBy: ['google'],
        presence: 'mentioned',
        note: 'Reviews from 2024 mention slow support, and Gemini repeats them.',
      },
      {
        domain: 'github.com',
        type: 'Code',
        share: 9,
        citedBy: ['perplexity'],
        presence: 'mentioned',
        note: 'Commit activity on your public SDK is read as proof of maintenance.',
      },
    ],
    conversation: {
      domain: 'reddit.com',
      where: 'r/projectmanagement',
      age: '2 days ago',
      engine: 'perplexity',
      title: 'Is Meterlane dead? Heard it got acquired',
      quote: 'Not acquired, the deal fell through in 2024. They shipped three releases last month.',
      brands: [
        { brand: 'Meterlane', mentions: 14, you: true },
        { brand: 'Asana', mentions: 3 },
        { brand: 'Linear', mentions: 2 },
      ],
      note: 'The thread is already correcting the rumour. A reply from your team linking the changelog gives the engines a primary source.',
    },
    risks: [
      {
        code: 'BS-FACT-001',
        engine: 'openai',
        severity: 'high',
        before: 'Worth checking before you commit. ',
        flagged: 'Meterlane was acquired in 2024 and is no longer actively maintained',
        after: ', so migration may become a concern.',
      },
      {
        code: 'BS-TRST-001',
        engine: 'google',
        severity: 'medium',
        before: 'Its website lists recent releases, though third-party reviews from 2024 mention ',
        flagged: 'slower support response times',
        after: '.',
      },
    ],
    alignment: {
      score: 58,
      facts: [
        {
          fact: 'Independent company, never acquired',
          status: 'contradicted',
          engines: ['openai'],
          note: 'ChatGPT repeats the 2024 acquisition rumour in 3 of 6 answers.',
        },
        { fact: 'A new release ships every two weeks', status: 'reflected', engines: ['anthropic', 'perplexity'] },
        { fact: 'Public changelog and status page', status: 'reflected', engines: ['anthropic', 'perplexity', 'google'] },
        { fact: 'Support replies within one business day', status: 'missed', engines: [] },
      ],
    },
    actions: [
      {
        kind: 'seo_gap',
        page: 'meterlane.com/changelog',
        detail: 'Cited in 14 answers, but missing from Google\'s top 20 for "meterlane updates".',
      },
      {
        kind: 'content_gap',
        page: 'techcrunch.com/2025/…/project-tools-to-watch',
        detail: 'ChatGPT cites this roundup when it points buyers to Asana and Linear instead. You are not in it.',
      },
      {
        kind: 'winning',
        page: 'meterlane.com/status',
        detail: 'Cited by Perplexity and Gemini, and earned 96 AI-referred visits in the last 30 days.',
      },
    ],
    digest: {
      channel: '#marketing',
      delta: -4,
      lines: [
        'New high alert: ChatGPT says Meterlane was acquired and is no longer maintained.',
        'Claude and Perplexity cite your changelog and get it right.',
        'Top action: publish a dated statement and ask TechCrunch for a correction.',
      ],
    },
  },
]

/* ── Derived metrics ─────────────────────────────────────────────── */

// Beta-Binomial posterior mean with the backend's Beta(2, 8) prior.
export function smoothedRate(successes, n, alpha = 2, beta = 8) {
  return (alpha + successes) / (alpha + beta + Math.max(0, n))
}

// Wilson score interval for a proportion. Returns [low, high] in 0..1.
export function wilsonInterval(successes, n, z = 1.96) {
  if (n <= 0) return [0, 0]
  const p = successes / n
  const denom = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / denom
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, centre - half), Math.min(1, centre + half)]
}

function rankPoints(avgRank) {
  if (avgRank <= 0) return 0
  if (avgRank <= 1) return 30
  if (avgRank <= 3) return 20
  if (avgRank <= 5) return 15
  if (avgRank <= 10) return 10
  return 5
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

// Rolls a prompt's per-engine runs up into the numbers the tour shows,
// using the same formula as RankingService's score computation.
export function summarizeRuns(runs) {
  const keys = Object.keys(runs)
  const perEngine = {}
  const allRanks = []
  const sentiment = { positive: 0, neutral: 0, negative: 0 }
  let answers = 0

  for (const key of keys) {
    const r = runs[key]
    answers += r.answers
    allRanks.push(...r.ranks)
    sentiment.positive += r.sentiment.positive
    sentiment.neutral += r.sentiment.neutral
    sentiment.negative += r.sentiment.negative
    perEngine[key] = {
      answers: r.answers,
      mentioned: r.ranks.length,
      rate: r.answers ? r.ranks.length / r.answers : 0,
      avgRank: mean(r.ranks),
    }
  }

  const mentioned = allRanks.length
  const avgRank = mean(allRanks)
  const [low, high] = wilsonInterval(mentioned, answers)
  const mention = smoothedRate(mentioned, answers) * 100 * 0.4
  const rank = rankPoints(avgRank)
  const sentimentPts = mentioned ? (sentiment.positive * 20 + sentiment.neutral * 10) / mentioned : 0
  const coverage = keys.length >= 3 ? 10 : (keys.length / 3) * 10

  return {
    answers,
    mentioned,
    rate: answers ? mentioned / answers : 0,
    low,
    high,
    avgRank,
    perEngine,
    score: {
      total: Math.trunc(Math.min(100, mention + rank + sentimentPts + coverage)),
      parts: { mention, rank, sentiment: sentimentPts, coverage },
    },
  }
}

// Splits answer text into runs: [[x]] is your brand, {{x}} a competitor.
// Rendering from runs keeps highlighting out of v-html.
export function parseSegments(text) {
  const out = []
  const re = /\[\[(.+?)\]\]|\{\{(.+?)\}\}/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), kind: 'plain' })
    if (m[1] !== undefined) out.push({ text: m[1], kind: 'you' })
    else out.push({ text: m[2], kind: 'rival' })
    last = re.lastIndex
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: 'plain' })
  return out
}
