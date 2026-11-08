import { DEMO_BOOKING_HREF } from './demo'

// Pricing tiers shown on the paywall.
//
// Two tiers: Pro ($45/mo self-serve, 7-day trial) and Business
// (contact sales). The per-tier ``maxPromptsPerAudit`` mirrors
// core.utils.constants.PLAN_LIMITS — keep in sync with the backend or
// the dashboard will lie about the cap a user has when their plan
// changes. Checkout is handled by Polar (backend creates the session).

export const TIERS = [
    {
        id: 'pro',
        name: 'Pro',
        price: 45,
        priceLabel: '$45',
        period: '/month',
        annualPrice: 450,
        annualPriceLabel: '$450',
        trialDays: 7,
        maxPromptsPerAudit: 15,
        description: 'Full access — every LLM provider and competitor tracking.',
        features: [
            '7-day free trial',
            'Up to 5 websites',
            '15 prompts per run',
            'Daily prompt runs',
            '4 LLM providers (Claude, GPT-4, Gemini, Perplexity)',
            'Competitor tracking + RAG knowledge base',
            'Trend intelligence + recommendations',
            'Priority support',
        ],
        cta: 'Start 7-day free trial',
        planCode: 'pro',
        highlight: true,
    },
    {
        id: 'business',
        name: 'Business',
        price: null,
        priceLabel: 'Custom',
        period: '',
        maxPromptsPerAudit: 50,
        description: 'Dedicated support, custom integrations, and unlimited scale.',
        features: [
            'Everything in Pro',
            'Unlimited websites',
            '50+ prompts per run',
            'Unlimited prompt runs',
            'SSO, SAML, audit logs',
            'Custom prompt packs',
            'API access + white-label',
            'Dedicated account manager',
        ],
        cta: 'Book a demo',
        planCode: 'business',
        // Scheduler URL when VITE_DEMO_BOOKING_URL is set, else a sales mailto.
        contactTarget: DEMO_BOOKING_HREF,
        highlight: false,
    },
]
