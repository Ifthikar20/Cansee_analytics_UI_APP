---
title: "AI-Ready Website Checklist: Schema, llms.txt and Crawlers"
description: "Use this AI-ready website checklist to set up structured data, decide on llms.txt, and let AI crawlers reach the pages that describe your business."
slug: "ai-ready-website-checklist"
date: "2026-11-08"
updated: "2026-11-08"
author: "Cansee team"
tags: [AI search, technical SEO, structured data, AI crawlers]
keywords: [AI-ready website checklist, structured data for AI, llms.txt, AI crawler access, robots.txt GPTBot, schema markup for AI search, technical SEO for AI assistants]
readingMinutes: 7
faq:
  - q: "Do I need an llms.txt file?"
    a: "It is optional. llms.txt is a community proposal rather than an established standard, and it is not clear how much the major assistants use it, so treat it as a low-effort extra after the basics are in place."
  - q: "Will blocking GPTBot remove my brand from ChatGPT answers?"
    a: "Not necessarily. OpenAI documents separate agents for training and for search and user-initiated browsing, so blocking one does not block the others. Check each provider's documentation and decide agent by agent."
  - q: "Does blocking Google-Extended affect my Google Search rankings?"
    a: "Google states that Google-Extended controls whether content is used for its Gemini models and does not affect how a site is crawled, indexed or ranked in Google Search."
  - q: "Which structured data types matter most for AI search?"
    a: "Start with Organization or LocalBusiness on your home or about page, Product and Offer on product and pricing pages, and Article on blog posts. Mark up only what is visible on the page and keep it accurate."
  - q: "How do I know whether AI crawlers can reach my site?"
    a: "Check your robots.txt rules, any bot protection settings at your CDN or host, and your server logs for visits from the user agents the AI providers document."
---

An AI-ready website is one that AI assistants can reach, read and understand without guessing. In practice that means three things: allow the AI crawlers you want in robots.txt and your security settings, describe your business with accurate structured data, and keep key facts in clear, server-rendered HTML. An llms.txt file is an optional extra on top of those basics.

This checklist walks through each area in order of impact, with notes on what to check and what to avoid.

## Why technical readiness matters for AI search

AI assistants such as ChatGPT, Claude, Gemini, Grok and Perplexity build answers from what their models learned in training and, for many questions, from pages they retrieve at the time of the question. If a crawler cannot fetch your pages, or fetches them but finds little readable content, your brand has less chance of being described accurately.

Technical readiness does not make an assistant recommend you on its own. Content quality and how others describe you matter a great deal, as covered in our [guide to generative engine optimization](/blog/generative-engine-optimization-guide). But technical problems can quietly undo good content, and they are usually quick to fix.

## Step 1: Decide which AI crawlers to allow

Each AI provider documents its own crawlers, and most respect robots.txt. Some agents collect data for training, some build a search index, and some fetch a page only when a user asks the assistant to look at it. You can allow or block each separately.

| Provider | Commonly documented agents | Purpose, in general terms |
| --- | --- | --- |
| OpenAI | GPTBot, OAI-SearchBot, ChatGPT-User | Training, search results in ChatGPT, user-requested fetches |
| Anthropic | ClaudeBot and related agents | Training and fetching for Claude |
| Google | Googlebot, Google-Extended | Search crawling; Google-Extended controls use in Gemini models |
| Perplexity | PerplexityBot and related agents | Indexing and fetching for Perplexity answers |

Agent names and purposes change, so confirm the current list on each provider's documentation pages before you edit your rules. xAI and other providers may use their own agents; check their documentation too.

A reasonable starting point for many businesses that want to be visible in AI answers is to allow search and user-initiated agents on public marketing pages, then decide on training agents according to your own policy. For example, a site that welcomes search and user-initiated agents but opts out of training might use a robots.txt like this:

```
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: PerplexityBot
Allow: /
Disallow: /admin/
Disallow: /checkout/
Disallow: /account/

User-agent: GPTBot
Disallow: /

User-agent: *
Disallow: /admin/
Disallow: /checkout/
Disallow: /account/

Sitemap: https://www.example.com/sitemap.xml
```

This is an example, not a recommendation for every site. Note how the private paths appear in every group. Under the robots.txt standard, a crawler follows only the most specific group that names it and ignores the `User-agent: *` group, so rules you put under `*` do not carry over to agents with their own group. Whatever you allow, keep private areas, account pages and checkout flows blocked in each group.

## Step 2: Check your security and CDN settings

Robots.txt is only half the picture. Many hosting providers, CDNs and security services offer bot protection, and some include options that block AI crawlers by default or with a single switch. A site can allow an agent in robots.txt and still return an error page or a challenge to that agent.

- Review the bot or firewall settings at your CDN and host.
- Make sure the settings match the decisions you made in robots.txt.
- Check that rate limits are not so strict that legitimate crawlers are cut off.
- Avoid serving a login wall or cookie wall that hides your main content from crawlers.

## Step 3: Confirm visits in your server logs

The only way to know that a crawler is reaching your pages is to look. Search your server or CDN logs for the user agents listed by each provider and note which pages they request and what status codes they receive.

Watch for:

- Repeated 403 or 429 responses, which suggest blocking or rate limiting.
- Crawlers only reaching your home page, which may point to weak internal linking or a missing sitemap.
- Visits from agents claiming to be AI crawlers that do not match the provider's published details. Some providers publish IP ranges you can use to verify genuine traffic.

## Step 4: Make key content readable without JavaScript

Not every crawler renders JavaScript the way a browser does. If your product descriptions, pricing or contact details only appear after scripts run, some crawlers may see an almost empty page.

- View the raw HTML of your key pages (for example with "view source") and check that the main text is there.
- Use server-side rendering or pre-rendering for marketing, pricing and documentation pages.
- Do not hide important facts inside images, tabs that load on click, or embedded widgets.
- Give each page a clear title, a single H1 and a short summary near the top.

## Step 5: Add accurate structured data

Structured data, usually written as JSON-LD using the schema.org vocabulary, labels the facts on a page in a machine-readable way: your organisation name, logo, address, products, prices and articles. Search engines use it, and it gives any system that reads your pages an unambiguous statement of key facts.

| Page | Useful schema types |
| --- | --- |
| Home or about page | Organization or LocalBusiness, with name, logo, URL, contact details and sameAs links to your official profiles |
| Product or service pages | Product or Service, with Offer for price and availability |
| Pricing page | Offer details that match the visible prices |
| Blog posts and guides | Article, with author and dates |
| FAQ sections | FAQPage, where the questions and answers are visible on the page |
| All pages | BreadcrumbList for site structure |

Rules to follow:

1. Mark up only what is visible on the page.
2. Keep structured data in sync with the page when prices or details change.
3. Use one consistent official name for your brand everywhere.
4. Validate your markup with a schema validator or Google's Rich Results Test.

Consistent, accurate facts are one of the best defences against assistants getting details wrong. If they already have, see [when AI gets your brand wrong](/blog/ai-misinformation-about-your-brand).

## Step 6: Decide whether to add llms.txt

llms.txt is a proposed convention: a plain Markdown file at the root of your site (for example, example.com/llms.txt) that briefly describes your site and links to the pages most useful for a language model, such as documentation, pricing and key guides. Some sites also publish a fuller version with page content included.

What to know before you add one:

- It is a community proposal, not a standard adopted by all AI providers.
- It is not clearly established which assistants read it or how much weight it carries.
- It does not replace robots.txt, which remains the way to allow or block crawlers.

Because it is cheap to create, adding one can be reasonable once the steps above are done. Keep it short, link only to public pages and update it when your key pages change.

## Step 7: Strengthen structure, freshness and readability

### Site structure and freshness

Crawlers find and interpret pages more easily on a well-organised site.

- Publish an XML sitemap and reference it in robots.txt.
- Use canonical tags to point duplicate pages at the main version.
- Link related pages to each other with descriptive anchor text.
- Show a visible "last updated" date on guides and pricing pages, and keep it honest.
- Redirect retired URLs to their current replacements rather than leaving outdated pages live.

### Pages that are easy to quote

Technical access gets crawlers to your content. The content itself decides whether it is useful in an answer. Lead with direct answers, use clear headings, state facts in plain sentences, and include tables for comparisons and specifications. Our guide to [writing content AI assistants can cite](/blog/content-ai-assistants-cite) covers this in detail.

## The checklist at a glance

1. Decide which AI agents to allow and write clear robots.txt rules.
2. Align CDN, firewall and bot protection settings with those rules.
3. Confirm crawler visits and status codes in your logs.
4. Make sure key content appears in the raw HTML.
5. Add accurate structured data and validate it.
6. Optionally publish a short llms.txt file.
7. Maintain a sitemap, canonical tags, internal links and honest update dates.
8. Write pages that lead with clear, quotable answers.

## Key takeaways

- Crawler access comes first: check robots.txt and your security settings together.
- Providers use separate agents for training, search and user-requested fetches, so decide on each one.
- Key facts should be readable in server-rendered HTML and described with accurate structured data.
- llms.txt is optional and its use by assistants is not clearly established.
- Technical readiness supports good content; it does not replace it.

Once your site is technically ready, the next question is whether it changes what assistants say. Cansee compares where you rank on Google with how ChatGPT, Claude, Gemini, Grok and Perplexity mention your brand, prompt by prompt, and suggests what to change on your pages. The [docs](/docs) explain how to set up your first prompts.
