// The words of the contextual help: HelpTips and tooltips along the main
// journeys, in one place so they can be reviewed and tested together. Each
// sentence describes what the code does today; change it with the code.
// Plain strings, no Vue. First-visit coachmarks are in ./hints.js.

export const TIPS = Object.freeze({
    onboarding: Object.freeze({
        prompts:
            'A prompt is a question a buyer types into Google or an AI assistant. Cansee asks your tracked prompts and records whether each answer names you.',
        offerings: 'List what you sell, by name. The agents use these names in every report and draft.',
        audience: 'Describe your buyers in a sentence or two. The agents write drafts for these readers.',
        competitors:
            'Add the companies you lose deals to. Cansee checks whether Google and the AI engines put them above you. Keep up to 5; you can change them later in Settings, Project.',
        location: 'The country Google results are checked from for these prompts. Pick where most of your buyers are.',
        engines:
            'Engines listed as not configured have no access set up on this workspace yet, so research skips them.',
        allowance:
            "What is left of your plan's AI allowance this month. Research, Ask AI and the agent draw from it, and it renews each billing period.",
    }),
    header: Object.freeze({
        project:
            'A project is one website. Switch projects, add another site or open its settings here. Analytics and the Agent follow the project you pick.',
        org: 'Your organization and your role in it. Open it to see team members or, as an admin, domains and SSO.',
        nav: Object.freeze({
            analytics: 'Your board: where Google and the AI engines rank you for the prompts you track.',
            agent: 'Chat with the agent to research your rankings, write drafts and save reports.',
            settings: 'Project details, Autopilot, connections, brand facts, team and billing.',
        }),
    }),
    board: Object.freeze({
        addWidget:
            "Add more views to this board, such as Competitors, Citations or Sentiment. Click a card's title to open its detailed view.",
        options: 'Board options. Reset board puts back Ask AI and Prompt ranking; your data is not touched.',
        emptyBody: 'Widgets show how Google and the AI engines treat your brand. Start with Ask AI or Prompt ranking.',
    }),
    askAi: Object.freeze({
        times: 'How many times each engine gets the question. More answers give a steadier share; each answer counts toward your AI allowance.',
        engines: 'Pick which engines to ask. At least one stays on.',
        estimate: 'The most this question can use. It comes out of your AI allowance, which renews each billing period.',
        track: 'Track adds this question to your tracked prompts, so it shows in Prompt ranking. With Autopilot on, it is asked the same way every day, so changes are comparable.',
    }),
    ranking: Object.freeze({
        top: 'Tracked prompts where AI names you most, as a share of answers in the last 7 days. 3/5 means named in 3 of 5 answers; the number in brackets is the change in points from the 7 days before.',
        weakest:
            'Tracked prompts where AI names you least. Start here: ask the agent for a page or article that answers them.',
        autopilot:
            'Autopilot asks your tracked prompts once a day on its own, so this ranking stays current without you logging in.',
        notRanked:
            'A share from a handful of answers is too noisy to rank. Ask AI answers stay in Ask AI; tracked prompts collect answers from Autopilot and from Check now.',
    }),
    settings: Object.freeze({
        nav: Object.freeze({
            autopilot: 'The daily run of your tracked prompts, its text message and past runs.',
            connections: 'Search Console, your traffic source and where daily reports go.',
            'brand-facts': 'The facts about your brand. Fact check tests AI answers against them, and the agents use them.',
        }),
        autopilot:
            'When on, Autopilot runs once a day at the time below and does what you tick under What runs.',
        traffic:
            'Each source counts something different. The Cansee pixel counts visitors and visits from AI assistants; Cloudflare counts every request and is the only one that sees AI crawlers.',
        reports:
            'Send the daily report to Slack, Discord or Microsoft Teams, so your team sees results without logging in. Daily text messages are set per project in Autopilot.',
        roles: 'Admins invite people and manage domains and SSO. Members run checks and use the agent. Viewers can see the work but not change it.',
        seats: 'Members and pending invites both use a seat. Your plan sets how many you have.',
    }),
    agent: Object.freeze({
        plus: 'Use a specialist agent, or open a web page beside the chat.',
        research:
            "Research agents work in parallel: they search Google, ask the AI engines and read your and your competitors' pages, then merge everything into one results table.",
        findings: "Tick rows to add them to Findings, the project's list of issues to fix.",
        saveReport: 'Save this reply to Reports, with the Google results and AI checks it was written from.',
        noProject: 'Pick a project first.',
        nav: Object.freeze({
            context: 'What the agents know about your brand, and where each fact comes from.',
            findings: 'Issues and opportunities from research, to fix and mark done.',
            reviews: 'Drafts waiting for review, and what was approved.',
            reports: 'Research you saved from chats.',
            sheets: 'Ad campaigns ready to export.',
            documents: 'Articles and pages the agents wrote.',
        }),
    }),
})
