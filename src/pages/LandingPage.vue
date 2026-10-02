<template>
  <div class="lp">
    <!-- ═══ Nav — floating ink pill ═══ -->
    <header class="nav" :class="{ scrolled }">
      <div class="nav-pill">
        <router-link to="/" class="brand" @click="closeNav">
          <img src="/images/cansee-logo.png" alt="Cansee" class="brand-logo" />
          <span class="brand-beta">Beta</span>
        </router-link>

        <nav class="nav-links" aria-label="Primary">
          <div class="nav-uc">
            <a href="#features" class="nav-uc-trigger" aria-haspopup="true">
              Use Cases
              <svg class="nav-uc-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </a>
            <div class="nav-uc-panel" role="menu" aria-label="Use cases">
              <span class="nav-uc-eyebrow">By use case</span>
              <div class="nav-uc-grid">
                <a
                  v-for="uc in useCases"
                  :key="uc.key"
                  :href="uc.anchor"
                  class="nav-uc-item"
                  role="menuitem"
                >
                  <span class="nav-uc-ic" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path v-for="(d, di) in uc.icon" :key="di" :d="d" />
                    </svg>
                  </span>
                  <span class="nav-uc-txt">
                    <span class="nav-uc-label">
                      {{ uc.label }}
                      <span class="nav-uc-tag">{{ uc.feature }}</span>
                    </span>
                    <span class="nav-uc-blurb">{{ uc.blurb }}</span>
                  </span>
                </a>
              </div>
              <a href="#how" class="nav-uc-foot">
                <span>Every use case runs on the same multi-engine scan.</span>
                <span class="nav-uc-foot-link">See how it works
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </span>
              </a>
            </div>
          </div>
          <a href="#tour">Product Tour</a>
          <a href="#features">Features</a>
          <a href="#how">How It Works</a>
        </nav>

        <div class="nav-right">
          <router-link to="/login" class="nav-link-text">Log In</router-link>
          <router-link to="/login" class="nav-cta">
            Get Started
            <span class="nav-cta-arrow" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
            </span>
          </router-link>
        </div>

        <button
          class="nav-burger"
          type="button"
          :aria-expanded="navOpen ? 'true' : 'false'"
          aria-controls="nav-sheet"
          :aria-label="navOpen ? 'Close menu' : 'Open menu'"
          @click="toggleNav"
        >
          <span class="nav-burger-bar"></span>
          <span class="nav-burger-bar"></span>
        </button>
      </div>

      <div
        id="nav-sheet"
        class="nav-sheet"
        :class="{ 'is-open': navOpen }"
        :inert="!navOpen"
        ref="navSheet"
      >
        <span class="nav-sheet-eyebrow">Use cases</span>
        <a
          v-for="uc in useCases"
          :key="uc.key"
          :href="uc.anchor"
          class="nav-sheet-uc"
          @click="closeNav"
        >{{ uc.label }}</a>
        <span class="nav-sheet-eyebrow">More</span>
        <a href="#tour" @click="closeNav">Product Tour</a>
        <a href="#features" @click="closeNav">Features</a>
        <a href="#how" @click="closeNav">How It Works</a>
        <router-link to="/login" class="nav-sheet-login" @click="closeNav">Log In</router-link>
        <router-link to="/login" class="nav-sheet-cta" @click="closeNav">Get Started</router-link>
      </div>
    </header>

    <!-- ═══ Hero ═══ -->
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-left">
          <h1 class="hero-h anim" data-anim="hero">
            BRAND VISIBILITY,<br/>
            MEASURED.<br/>
            OPTIMIZED.<br/>
            <em>FOR THE AGENTIC ERA.</em>
          </h1>
          <div class="hero-sub anim" data-anim="fade-up" data-delay="60">
            <p class="hero-p">
              See how often
              <span class="hero-word-cycler" aria-live="off">
                <TransitionGroup name="word-cycle">
                  <span class="hero-word" :key="categories[activeCat]">{{ categories[activeCat] }}</span>
                </TransitionGroup>
              </span>
              mentions your brand. Find the prompts you're missing from, the sources
              shaping the answers, and what they get wrong — and get the findings where
              you already work, in Slack or Discord.
            </p>
            <a href="#tour" class="hero-tour-link">
              Take the product tour
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
          </div>
        </div>

        <!-- Hero media. This is the page's LCP element, so it is eager and
             high priority — never lazy-loaded. -->
        <div class="hero-right anim" data-anim="fade-up" data-delay="220">
          <img
            class="hero-media"
            src="/images/retro.jpg"
            alt=""
            width="3116"
            height="2080"
            fetchpriority="high"
            decoding="async"
          />
        </div>
      </div>
    </section>

    <!-- ═══ Trust strip ═══ -->
    <section class="trust anim" data-anim="fade-up">
      <div class="trust-row">
        <span class="trust-label">Probes across</span>
        <span class="trust-item">Anthropic Claude</span>
        <span class="trust-item">OpenAI ChatGPT</span>
        <span class="trust-item">Google Gemini</span>
        <span class="trust-item">Perplexity</span>
      </div>
    </section>

    <!-- ═══ Why this exists — split editorial layout ═══ -->
    <section class="why anim" data-anim="fade-up">
      <div class="wrap why-wrap">
        <div class="why-split">
          <div class="why-left">
            <h2 class="why-h">
              LLMs are where people ask.<br/>
              <span class="why-h-quiet">Your buyers ask before they Google.</span>
            </h2>
            <p class="why-sub">
              More than half of B2B buyers now research vendors inside ChatGPT, Claude,
              Gemini, and Perplexity before they ever land on a website. Whatever those
              four models say about you is, for a lot of people, the only thing they will
              hear.
            </p>

            <ul class="why-list">
              <li v-for="(w, i) in whyItems" :key="i" class="why-row">
                <button
                  type="button"
                  class="why-item"
                  :class="{ 'is-active': activeWhy === i }"
                  :aria-pressed="activeWhy === i ? 'true' : 'false'"
                  @click="activeWhy = i"
                >
                  <span class="why-item-num">{{ w.num }}</span>
                  <span class="why-item-label">{{ w.label }}</span>
                  <span class="why-item-arrow" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <div class="why-right">
            <div class="why-panel">
              <div class="why-demo">
                <Transition name="why-demo-fade" mode="out-in">
                  <div v-if="activeWhy === 0" key="demo-0" class="why-demo-panel">
                    <div class="why-demo-head">
                      <span class="why-demo-dot" style="background:#10a37f"></span>
                      ChatGPT
                    </div>
                    <div class="why-demo-body">
                      Top vendors for enterprise <em>observability</em>:
                      <ol class="why-demo-list">
                        <li>Datadog</li>
                        <li>New Relic</li>
                        <li>Grafana</li>
                        <li class="why-demo-you">
                          Meterlane LLC
                          <span class="why-demo-you-tag" aria-hidden="true">
                            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                              <path d="M13 5H1M1 5l4-4M1 5l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            This is you
                          </span>
                        </li>
                      </ol>
                    </div>
                    <div class="why-demo-foot">
                      You rank <strong>#1 on Google</strong> for the same query.
                      Nobody sees it — until you show up here.
                    </div>
                  </div>

                  <div v-else-if="activeWhy === 1" key="demo-1" class="why-demo-panel">
                    <div class="why-demo-head">
                      <span class="why-demo-dot" style="background:#c26fff"></span>
                      Claude
                    </div>
                    <div class="why-demo-body">
                      Three tools worth evaluating:
                      <ol class="why-demo-list">
                        <li class="hi">Vendor A</li>
                        <li class="hi">Vendor B</li>
                        <li class="hi">Vendor C</li>
                      </ol>
                    </div>
                    <div class="why-demo-foot">
                      No scroll to position twelve.
                      <strong>Made the shortlist or you didn't.</strong>
                    </div>
                  </div>

                  <div v-else key="demo-2" class="why-demo-panel why-demo-panel--metrics">
                    <div class="why-demo-head">
                      <span class="why-demo-dot" style="background:#ff385c"></span>
                      This week
                    </div>
                    <div class="why-demo-metric">
                      <span class="why-demo-metric-value">3 <small>/ 47</small></span>
                      <span class="why-demo-metric-label">answers where your brand appears</span>
                    </div>
                    <div class="why-demo-bars">
                      <div class="why-demo-bar-row">
                        <span class="lbl">ChatGPT</span>
                        <span class="bar"><span style="width:15%"></span></span>
                        <span class="val">2/13</span>
                      </div>
                      <div class="why-demo-bar-row">
                        <span class="lbl">Claude</span>
                        <span class="bar"><span style="width:8%"></span></span>
                        <span class="val">1/12</span>
                      </div>
                      <div class="why-demo-bar-row">
                        <span class="lbl">Gemini</span>
                        <span class="bar"><span style="width:0%"></span></span>
                        <span class="val">0/11</span>
                      </div>
                      <div class="why-demo-bar-row">
                        <span class="lbl">Perplexity</span>
                        <span class="bar"><span style="width:0%"></span></span>
                        <span class="val">0/11</span>
                      </div>
                    </div>
                    <div class="why-demo-foot">
                      <strong>Stop guessing.</strong> Pulled from all four on schedule.
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </div>

        <div class="why-cta anim" data-anim="fade-up" data-delay="300">
          <span class="why-cta-line">The brands winning AI search are the ones <strong>measuring it</strong>.</span>
          <router-link to="/login" class="why-cta-btn">
            See where you stand
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </router-link>
        </div>
      </div>
    </section>

    <!-- ═══ Stats / Why GEO matters ═══ -->
    <section class="stats anim" data-anim="fade-up" ref="statsSection">
      <div class="wrap">
        <div class="stats-card anim" data-anim="framer">
          <video
            class="stats-card-bg"
            autoplay
            muted
            loop
            playsinline
            preload="metadata"
            disablepictureinpicture
            aria-hidden="true"
          >
            <source :src="assetUrl('/images/market-back-ground.mp4')" type="video/mp4" />
          </video>
          <div class="stats-card-tint"></div>

          <div class="stats-card-content">
            <div class="stats-card-top">
              <h2 class="stats-card-h anim" data-anim="hero" data-delay="400">
                AI search is the new search.<br/>
                <em>Your brand isn't ready for it.</em>
              </h2>
              <p class="stats-card-sub anim" data-anim="fade-up" data-delay="550">
                ChatGPT and Perplexity already shape millions of buying decisions every day.
                The brands that show up in those answers are the ones writing the right things
                in the right places.
              </p>
            </div>

            <div class="stats-card-bottom">
              <div class="stats-card-metric anim" data-anim="fade-up" data-delay="700">
                <div class="stats-card-num">{{ stat0Display }}<span class="stats-card-suffix">%</span></div>
                <div class="stats-card-label">Buyers research with LLMs</div>
                <div class="stats-card-note">of B2B buyers used LLMs during their buying process in 2025</div>
                <a
                  class="stats-card-cite"
                  href="https://6sense.com/science-of-b2b/buyer-experience-report-2025/"
                  target="_blank"
                  rel="noopener"
                >Source: 6sense, 2025 Buyer Experience Report</a>
              </div>
              <div class="stats-card-metric anim" data-anim="fade-up" data-delay="850">
                <div class="stats-card-num"><span class="stats-card-prefix">+</span>{{ stat1Display }}<span class="stats-card-suffix">%</span></div>
                <div class="stats-card-label">Visibility you can win</div>
                <div class="stats-card-note">lift in brand visibility from GEO-optimized content in AI answers</div>
                <a
                  class="stats-card-cite"
                  href="https://arxiv.org/abs/2311.09735"
                  target="_blank"
                  rel="noopener"
                >Source: Aggarwal et al., GEO (KDD 2024)</a>
              </div>
              <div class="stats-card-metric anim" data-anim="fade-up" data-delay="1000">
                <div class="stats-card-num">{{ stat2Display }}<span class="stats-card-suffix">%</span></div>
                <div class="stats-card-label">Zero-click searches</div>
                <div class="stats-card-note">of searches now end without a click to another website</div>
                <a
                  class="stats-card-cite"
                  href="https://www.bain.com/insights/goodbye-clicks-hello-ai-zero-click-search-redefines-marketing/"
                  target="_blank"
                  rel="noopener"
                >Source: Bain &amp; Company, 2025</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Product tour — one question, end to end, on sample data ═══ -->
    <ProductTour class="anim" data-anim="fade-up" />

    <!-- ═══ Feature showcase — alternating rows ═══ -->
    <section class="feature-showcase" id="features">
      <div class="wrap">
        <div
          v-for="(f, i) in showcaseFeatures"
          :id="'uc-' + f.key"
          :key="f.key"
          class="feature-row anim"
          :class="{ 'is-reverse': i % 2 === 1 }"
          data-anim="fade-up"
        >
          <div class="feature-copy">
            <span class="feature-eyebrow">{{ f.eyebrow }}</span>
            <h2 class="feature-h">{{ f.headline }}</h2>
            <p class="feature-desc">{{ f.desc }}</p>
            <ul class="feature-bullets">
              <li v-for="b in f.bullets" :key="b"><span class="feature-bullet-dot"></span>{{ b }}</li>
            </ul>
          </div>
          <div class="feature-visual" :class="'is-' + f.key">
            <video
              class="feature-visual-bg"
              autoplay
              muted
              loop
              playsinline
              preload="metadata"
              disablepictureinpicture
              aria-hidden="true"
            >
              <source :src="assetUrl('/videos/' + f.video)" type="video/mp4" />
              <!-- feature-1..4.mp4 live only on the CDN. Without this the
                   wells render as flat ink anywhere the CDN isn't reachable
                   (local dev included), and the watercolor frame is the
                   whole point of the treatment. -->
              <source :src="assetUrl('/videos/' + f.fallbackVideo)" type="video/mp4" />
            </video>
            <div class="feature-visual-tint" aria-hidden="true"></div>

            <!-- PROMPT LIBRARY — the tracked-prompt table, as the real page
                 shows it: filter bar, then a row per prompt carrying the
                 measured columns (visibility, position, model coverage). -->
            <div v-if="f.key === 'prompt'" class="mock-card">
              <div class="mock-lib-head">
                <div class="mock-lib-title">Prompts <span class="mock-lib-count">42 tracked</span></div>
                <div class="mock-lib-tools">
                  <span class="mock-chip">Bulk upload</span>
                  <span class="mock-chip">Add prompt</span>
                </div>
              </div>
              <div class="mock-search">
                <span class="mock-search-icon"></span>
                <span class="mock-search-text">{{ typedPrompt }}</span>
                <span class="mock-search-caret">|</span>
              </div>
              <div class="mock-rows">
                <transition-group name="mock-row-stagger" tag="div">
                  <div
                    v-for="(p, idx) in visiblePromptRows"
                    :key="p.id"
                    class="mock-prompt-row"
                    :class="{ 'is-pinned': pinnedPromptId === p.id }"
                    :style="{ animationDelay: (0.05 + idx * 0.10) + 's' }"
                    @click="togglePin(p)"
                  >
                    <div class="mock-prompt-main">
                      <span class="mock-q">{{ p.q }}</span>
                      <span class="mock-chip">{{ p.tag }}</span>
                    </div>

                    <div class="mock-prompt-meta">
                      <span class="mock-metric"><b>{{ p.visibility }}%</b> visibility</span>
                      <span class="mock-metric">avg #{{ p.position }}</span>
                      <span class="mock-metric">{{ p.country }}</span>
                      <span class="mock-models" :title="coverageLabel(p)">
                        <span
                          v-for="k in MODEL_KEYS"
                          :key="k"
                          class="mock-model-dot"
                          :class="['is-' + k, { 'is-hit': p.models?.[k] }]"
                          :title="MODEL_LABEL[k] + (p.models?.[k] ? ' — surfaces you' : ' — does not surface you')"
                        ></span>
                      </span>
                    </div>

                    <div v-if="pinnedPromptId === p.id" class="mock-prompt-detail">
                      <div class="mock-detail-row">
                        <span class="mock-detail-label">Group</span>
                        <span class="mock-detail-value">{{ p.group }}</span>
                      </div>
                      <div class="mock-detail-row">
                        <span class="mock-detail-label">Mentions</span>
                        <span class="mock-detail-value">{{ p.mentions }}</span>
                      </div>
                      <div class="mock-detail-row">
                        <span class="mock-detail-label">Next run</span>
                        <span class="mock-detail-value">{{ p.nextRun }}</span>
                      </div>
                      <div class="mock-detail-row">
                        <span class="mock-detail-label">Coverage</span>
                        <span class="mock-detail-value">{{ coverageLabel(p) }}</span>
                      </div>
                      <ul class="mock-detail-models">
                        <li
                          v-for="k in MODEL_KEYS"
                          :key="k"
                          :class="p.models?.[k] ? 'is-hit' : 'is-miss'"
                        >
                          <span class="mock-model-dot" :class="['is-' + k, { 'is-hit': p.models?.[k] }]"></span>
                          {{ MODEL_LABEL[k] }}
                          <span class="mock-detail-status">
                            {{ p.models?.[k] ? 'mentions you' : 'gap — not mentioned' }}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </transition-group>
              </div>
            </div>

            <!-- MULTI-LLM PROBING -->
            <div v-else-if="f.key === 'probe'" class="mock-card">
              <div class="mock-probe-head">
                <div>
                  <div class="mock-probe-title">Visibility score</div>
                  <div class="mock-probe-sub">Click a model to see avg rank, sentiment, and who beats you</div>
                </div>
                <div class="mock-probe-score">
                  <span class="mock-probe-score-num">{{ heroAvgVisibility }}%</span>
                  <span class="mock-probe-score-label">across 4 models</span>
                </div>
              </div>

              <div class="mock-probe-grid">
                <div
                  v-for="(p, idx) in heroProviders"
                  :key="p.key"
                  class="mock-probe-card"
                  :class="{ 'is-pinned': pinnedProbeKey === p.key }"
                  :style="{ animationDelay: (0.15 + idx * 0.10) + 's' }"
                  @click="toggleProbePin(p)"
                >
                  <div class="mock-probe-row">
                    <span class="mock-probe-name">
                      <span class="mock-source-dot" :class="'is-' + p.key"></span>
                      {{ p.name }}
                    </span>
                    <span class="mock-probe-pct">{{ p.pct }}%</span>
                  </div>

                  <div class="mock-probe-bar" :title="p.pct + '% visibility'">
                    <div
                      class="mock-probe-bar-fill"
                      :class="'is-' + p.key"
                      :style="{ '--target-w': p.pct + '%', animationDelay: (0.3 + idx * 0.10) + 's' }"
                    ></div>
                  </div>

                  <div class="mock-probe-stats">
                    <span
                      class="mock-probe-delta"
                      :class="p.delta >= 0 ? 'is-up' : 'is-down'"
                      :title="'Week over week'"
                    >{{ p.delta >= 0 ? '+' : '' }}{{ p.delta }}%</span>
                    <span class="mock-probe-stat" :title="'Average rank when mentioned'">
                      avg #{{ p.rank.toFixed(1) }}
                    </span>
                    <span class="mock-probe-stat" :title="p.citations + ' citations carried in answers'">
                      {{ p.citations }} citations
                    </span>
                  </div>

                  <div v-if="pinnedProbeKey === p.key" class="mock-probe-detail">
                    <div class="mock-detail-row">
                      <span class="mock-detail-label">Sentiment</span>
                      <span class="mock-probe-sent" :title="'Positive / neutral / negative split of mentions'">
                        <span class="mock-probe-sent-seg pos" :style="{ '--w': p.sentiment.pos * 100 + '%' }"></span>
                        <span class="mock-probe-sent-seg neu" :style="{ '--w': p.sentiment.neu * 100 + '%' }"></span>
                        <span class="mock-probe-sent-seg neg" :style="{ '--w': p.sentiment.neg * 100 + '%' }"></span>
                      </span>
                    </div>
                    <div class="mock-detail-row">
                      <span class="mock-detail-label">Most cited competitor</span>
                      <span class="mock-detail-value">
                        {{ p.topCompetitor.name }} <span class="mock-probe-comp">· {{ p.topCompetitor.share }}% of answers</span>
                      </span>
                    </div>
                    <div class="mock-detail-row">
                      <span class="mock-detail-label">Brand safety</span>
                      <span
                        class="mock-probe-safety"
                        :class="p.hallucinations === 0 ? 'is-ok' : 'is-warn'"
                      >
                        {{ p.hallucinations === 0 ? 'Clean' : p.hallucinations + ' unverified claim' + (p.hallucinations === 1 ? '' : 's') }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SOURCE INFLUENCE -->
            <div v-else-if="f.key === 'source'" class="mock-card">
              <div class="mock-source-head">
                <div class="mock-source-title">Top cited domains <span class="mock-lib-count">last 30 days</span></div>
                <div class="mock-source-sub">Click a domain to see which models cite it and where you sit</div>
              </div>

              <div
                v-for="(d, idx) in topDomains"
                :key="d.domain"
                class="mock-source-row"
                :class="{ 'is-pinned': pinnedSourceKey === d.domain }"
                :style="{ animationDelay: (0.15 + idx * 0.12) + 's' }"
                @click="toggleSourcePin(d)"
              >
                <div class="mock-source-line">
                  <span class="mock-source-label">
                    <span class="mock-rank-num">{{ idx + 1 }}</span>
                    {{ d.domain }}
                    <span class="mock-chip">{{ d.type }}</span>
                  </span>
                  <span
                    class="mock-source-rank"
                    :class="d.yourRank == null ? 'is-miss' : 'is-hit'"
                    :title="domainRankLabel(d)"
                  >{{ d.yourRank == null ? 'you: not cited' : 'you: #' + d.yourRank }}</span>
                </div>

                <div class="mock-stack" role="img" :aria-label="d.share + '% of all citations'">
                  <span
                    class="mock-seg"
                    :style="{ '--target-w': d.share * 3 + '%', animationDelay: (0.3 + idx * 0.12) + 's' }"
                  ></span>
                  <span class="mock-share-pct">{{ d.share }}%</span>
                </div>

                <div v-if="pinnedSourceKey === d.domain" class="mock-source-detail">
                  <div class="mock-detail-row">
                    <span class="mock-detail-label">Cited by</span>
                    <span class="mock-detail-value">{{ d.citedBy.join(', ') }}</span>
                  </div>
                  <div class="mock-detail-row">
                    <span class="mock-detail-label">Your position here</span>
                    <span class="mock-detail-value">{{ domainRankLabel(d) }}</span>
                  </div>
                  <div class="mock-source-takeaway">{{ d.takeaway }}</div>
                </div>
              </div>

              <div class="mock-next">
                <div class="mock-next-title">What to do next</div>
                <div v-for="o in sourceOpportunities" :key="o.title" class="mock-next-row">
                  <span class="mock-next-label">{{ o.title }}</span>
                  <span class="mock-next-count">{{ o.count }}</span>
                </div>
              </div>
            </div>

            <!-- BRAND SECURITY — live alerts feed -->
            <div v-else-if="f.key === 'security'" class="mock-card">
              <div class="mock-sec-head">
                <div class="mock-sec-title">Brand Security</div>
                <div class="mock-sec-count">3 open findings</div>
              </div>

              <div class="mock-sec-alerts">
                <div v-for="fi in securityFindings" :key="fi.code" class="mock-sec-alert">
                  <div class="mock-sec-alert-head">
                    <span class="mock-sec-agent">{{ fi.category }}</span>
                    <span class="mock-sec-sev" :class="'is-' + fi.severity">{{ fi.severityLabel }}</span>
                  </div>
                  <div class="mock-sec-meta">{{ fi.model }} · {{ fi.code }}</div>
                  <!-- The flagged span is the point: the product stores
                       character offsets per finding, so it can quote the
                       exact sentence rather than summarising it. -->
                  <blockquote class="mock-sec-quote">
                    {{ fi.before }}<mark class="mock-sec-flag">{{ fi.flagged }}</mark>{{ fi.after }}
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ How It Works ═══ -->
    <section class="how" id="how">
      <div class="wrap">
        <h2 class="sec-h anim" data-anim="hero">Up and running<br/><em>in 3 minutes.</em></h2>
        <div class="steps">
          <div v-for="(s, i) in steps" :key="i" class="step anim" data-anim="fade-up" :data-delay="i * 80">
            <div class="step-num">{{ i + 1 }}</div>
            <h3>{{ s.title }}</h3>
            <p>{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ FAQ ═══ -->
    <section class="faq" id="faq">
      <div class="wrap faq-wrap">
        <aside class="faq-aside anim" data-anim="fade-up">
          <span class="faq-eyebrow">FAQ</span>
          <h2 class="faq-h">Questions,<br/><em>answered plainly.</em></h2>
          <router-link to="/contact" class="faq-aside-btn">Contact us</router-link>
        </aside>
        <div class="faq-list">
          <details v-for="(item, i) in faqItems" :key="i" class="faq-item anim" data-anim="fade-up" :data-delay="i * 60">
            <summary>
              <span>{{ item.q }}</span>
              <span class="faq-plus" aria-hidden="true"></span>
            </summary>
            <div class="faq-a"><p>{{ item.a }}</p></div>
          </details>
        </div>
      </div>
    </section>

    <!-- ═══ Final CTA ═══ -->
    <section class="final-cta anim" data-anim="fade-up" ref="finalCtaSection">
      <video class="final-cta-video" autoplay muted loop playsinline aria-hidden="true">
        <source :src="assetUrl('/videos/watercolor-main.mp4')" type="video/mp4" />
      </video>
      <div class="final-cta-overlay" aria-hidden="true"></div>
      <div class="final-cta-glow" aria-hidden="true"></div>
      <div class="wrap cta-inner">
        <h2>Ready to grow <em>smarter?</em></h2>
        <p>Start your first AI visibility prompt run in minutes.</p>
        <router-link to="/login" class="btn-primary">Get Started</router-link>
      </div>
    </section>

    <!-- ═══ Sticky CTA pill ═══ -->
    <transition name="sticky-cta">
      <router-link
        v-if="showStickyCta"
        to="/login"
        class="sticky-cta"
      >
        Start a free prompt run
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </router-link>
    </transition>

    <!-- ═══ Footer ═══ -->
    <footer class="footer">
      <div class="wrap">
        <!-- Top row: brand + 4 link columns -->
        <div class="footer-grid">
          <div class="footer-brand-col">
            <div class="footer-brand">
              <img src="/images/cansee-logo.png" alt="Cansee" class="footer-logo" />
            </div>
            <p class="footer-tagline">
              Generative Engine Optimization for brands that want to be found
              by AI assistants. Measure, verify, and close the gap.
            </p>
            <div class="footer-socials">
              <a href="https://twitter.com/cansee" target="_blank" rel="noopener" aria-label="Twitter / X" class="footer-social">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://linkedin.com/company/cansee" target="_blank" rel="noopener" aria-label="LinkedIn" class="footer-social">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.26 2.37 4.26 5.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45C23.21 24 24 23.23 24 22.28V1.72C24 .77 23.21 0 22.22 0z"/></svg>
              </a>
              <a href="https://github.com/cansee" target="_blank" rel="noopener" aria-label="GitHub" class="footer-social">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              </a>
            </div>
          </div>

          <div class="footer-col">
            <div class="footer-col-title">Product</div>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </div>

          <div class="footer-col">
            <div class="footer-col-title">Resources</div>
            <router-link to="/docs">Documentation</router-link>
            <router-link to="/blog">Blog</router-link>
            <router-link to="/changelog">Changelog</router-link>
            <router-link to="/status">Status</router-link>
          </div>

          <div class="footer-col">
            <div class="footer-col-title">Company</div>
            <router-link to="/about">About</router-link>
            <router-link to="/contact">Contact us</router-link>
            <a href="mailto:hello@cansee.ai">hello@cansee.ai</a>
          </div>

          <div class="footer-col">
            <div class="footer-col-title">Legal</div>
            <router-link to="/terms">Terms of Service</router-link>
            <router-link to="/privacy">Privacy Policy</router-link>
            <router-link to="/dpa">Data Processing Agreement</router-link>
            <router-link to="/cookies">Cookie Policy</router-link>
            <router-link to="/ai-policy">Responsible AI Use</router-link>
            <!-- Reopen the Cookiebot consent dialog. Only shown once a
                 Cookiebot domain ID is configured, so it never dead-ends
                 in environments without the consent banner. -->
            <button
              v-if="cookiebotConfigured"
              type="button"
              class="footer-link-btn"
              @click="renewCookieConsent"
            >Cookie settings</button>
          </div>
        </div>

        <!-- Bottom row: copy + meta links -->
        <div class="footer-bottom">
          <span class="footer-copy">© 2026 Cansee, Inc. All rights reserved.</span>
          <div class="footer-meta">
            <span class="footer-meta-item">
              <span class="footer-status-dot"></span>
              All systems operational
            </span>
            <span class="footer-meta-divider">·</span>
            <span class="footer-meta-item">Made with care for the AI-search era</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { assetUrl } from '@/utils/assetUrl'
import ProductTour from '@/components/landing/ProductTour.vue'

const scrolled = ref(false)
const activeCat = ref(0)
const activeWhy = ref(0)

/* ── Cookie consent (Cookiebot / Usercentrics) ──
   The banner itself loads from index.html when VITE_COOKIEBOT_CBID is set.
   Here we only surface a footer "Cookie settings" link that reopens the
   consent dialog — shown solely when Cookiebot is configured. */
const cookiebotConfigured = Boolean(import.meta.env.VITE_COOKIEBOT_CBID)
function renewCookieConsent() {
  if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') {
    window.Cookiebot.renew()
  }
}

/* ── Mobile nav sheet ──
   The desktop pill collapses below 1024px, so everything inside it
   needs a home. The sheet owns focus while open and hands it back
   to the trigger on close. */
const navOpen = ref(false)
const navSheet = ref(null)
let navReturnFocus = null

function openNav() {
  navReturnFocus = document.activeElement
  navOpen.value = true
}
function closeNav() {
  navOpen.value = false
}
function toggleNav() {
  navOpen.value ? closeNav() : openNav()
}

function onNavKeydown(ev) {
  if (!navOpen.value) return
  if (ev.key === 'Escape') { closeNav(); return }
  if (ev.key !== 'Tab') return
  const sheet = navSheet.value
  if (!sheet) return
  const focusables = sheet.querySelectorAll('a[href], button:not([disabled])')
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault(); last.focus()
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault(); first.focus()
  }
}

let cycleTimer = null

function startCycle() {
  cycleTimer = setInterval(() => {
    activeCat.value = (activeCat.value + 1) % categories.length
  }, 2800)
}

onMounted(() => {
  const onScroll = () => { scrolled.value = window.scrollY > 40 }
  window.addEventListener('scroll', onScroll, { passive: true })

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const d = parseInt(e.target.dataset.delay || '0')
        setTimeout(() => e.target.classList.add('in'), d)
        obs.unobserve(e.target)
      }
    })
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

  document.querySelectorAll('.anim').forEach(el => obs.observe(el))
  startCycle()

  // Seven <video> elements now decorate this page, several of them the
  // same multi-megabyte watercolor clip at different sizes. Decoding all
  // of them at once is wasted work, so only the ones near the viewport
  // are allowed to run.
  const videoObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const v = e.target
      // Unconditional pause: guarding on v.paused misses the ones that
      // haven't started yet, and autoplay then picks them up anyway.
      if (e.isIntersecting) v.play().catch(() => {})
      else v.pause()
    })
  }, { rootMargin: '200px 0px' })
  document.querySelectorAll('.lp video').forEach(v => videoObs.observe(v))

  // Close the mobile sheet if the viewport grows back to desktop.
  const desktopMq = window.matchMedia('(min-width: 1024px)')
  const onDesktop = (e) => { if (e.matches) closeNav() }
  desktopMq.addEventListener('change', onDesktop)
  document.addEventListener('keydown', onNavKeydown)

  // Count-up stats observer
  let statsObs = null
  if (statsSection.value) {
    statsObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { animateStats(); statsObs && statsObs.disconnect() } })
    }, { threshold: 0.3 })
    statsObs.observe(statsSection.value)
  }

  // Sticky CTA: show after hero, hide on final CTA
  const heroEl = document.querySelector('.hero')
  let heroObs = null
  if (heroEl) {
    heroObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { pastHero = !e.isIntersecting || e.intersectionRatio < 0.2; updateStickyCta() })
    }, { threshold: [0, 0.2, 0.5] })
    heroObs.observe(heroEl)
  }
  let finalObs = null
  if (finalCtaSection.value) {
    finalObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { onFinalCta = e.isIntersecting; updateStickyCta() })
    }, { threshold: 0.2 })
    finalObs.observe(finalCtaSection.value)
  }

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    desktopMq.removeEventListener('change', onDesktop)
    document.removeEventListener('keydown', onNavKeydown)
    document.body.style.overflow = ''
    obs.disconnect()
    videoObs.disconnect()
    statsObs && statsObs.disconnect()
    heroObs && heroObs.disconnect()
    finalObs && finalObs.disconnect()
    clearInterval(cycleTimer)
    if (_promptCycleStop) _promptCycleStop()
  })

  // Demand-prompt cycler — kicks in after the page hydrates so the search
  // bar starts typing the first example almost immediately.
  setTimeout(startPromptCycle, 400)
})

/* Lock the page behind the mobile sheet, and move focus into it. */
watch(navOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  updateStickyCta()
  if (open) {
    await nextTick()
    const first = navSheet.value?.querySelector('a[href], button:not([disabled])')
    first && first.focus()
  } else if (navReturnFocus && document.contains(navReturnFocus)) {
    navReturnFocus.focus()
    navReturnFocus = null
  }
})

const categories = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity']

const whyItems = [
  { num: '01', label: 'Google ranks pages. AI ranks brands.' },
  { num: '02', label: "If you're not in the answer, you're not in the deal." },
  { num: '03', label: 'Most teams have no idea what the models say.' },
]
// Multi-LLM Probing demo data — every field is what the in-product report
// surfaces per model after a scan: visibility rate, week-over-week delta,
// avg rank when mentioned, sentiment split, number of citations carried
// in the response, the competitor that beats you most often, and a brand-
// safety flag indicating any hallucinations or unverified claims surfaced.
const heroProviders = [
  {
    key: 'anthropic', name: 'Claude',
    pct: 47, delta: 8, rank: 3.1, citations: 12, hallucinations: 0,
    sentiment: { pos: 0.7, neu: 0.25, neg: 0.05 },
    topCompetitor: { name: 'Asana', share: 18 },
  },
  {
    key: 'openai', name: 'ChatGPT',
    pct: 38, delta: -3, rank: 4.6, citations: 8, hallucinations: 1,
    sentiment: { pos: 0.55, neu: 0.35, neg: 0.10 },
    topCompetitor: { name: 'Linear', share: 22 },
  },
  {
    key: 'google', name: 'Gemini',
    pct: 52, delta: 12, rank: 2.4, citations: 15, hallucinations: 0,
    sentiment: { pos: 0.66, neu: 0.30, neg: 0.04 },
    topCompetitor: { name: 'Notion', share: 14 },
  },
  {
    key: 'perplexity', name: 'Perplexity',
    pct: 64, delta: 17, rank: 1.8, citations: 21, hallucinations: 0,
    sentiment: { pos: 0.74, neu: 0.22, neg: 0.04 },
    topCompetitor: { name: 'Trello', share: 9 },
  },
]
const heroAvgVisibility = computed(() =>
  Math.round(heroProviders.reduce((s, p) => s + p.pct, 0) / heroProviders.length),
)
const pinnedProbeKey = ref(null)
function toggleProbePin(p) {
  pinnedProbeKey.value = pinnedProbeKey.value === p.key ? null : p.key
}

const steps = [
  { title: 'Add Your Brand', desc: 'Drop in your domain and the competitors you want to track. We map your category instantly.' },
  { title: 'Pick Your Prompts', desc: 'We mine real buyer questions from Reddit, Quora, and search trends — you approve the set you want to rank for.' },
  { title: 'Watch LLM Visibility', desc: 'We run those prompts across every major LLM and stream back where you show up, where competitors win, and which sources shape the answers.' },
  { title: 'Get It Where You Work', desc: 'Daily or weekly digests in Slack, Discord, or Microsoft Teams, and CSV exports of your prompts and analytics events.' },
]

/* ── Showcase features (alternating rows) ── */
// The use cases the product actually delivers (each verified against the
// codebase). `feature` names the surface that powers it; `anchor` jumps to
// the matching feature row where one exists, else to the features section.
const useCases = [
  {
    key: 'rank',
    label: 'See where AI ranks you',
    feature: 'Multi-LLM probing',
    blurb: 'Your visibility, share of voice, and who AI recommends instead — from the first scan.',
    anchor: '#uc-probe',
    icon: ['M12 2v20', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20', 'M12 2a15 15 0 0 0 0 20'],
  },
  {
    key: 'security',
    label: 'Catch harmful AI answers',
    feature: 'Brand Security',
    blurb: 'Negative, false, or unfavourable claims — flagged with the exact sentence.',
    anchor: '#uc-security',
    icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M12 8v4', 'M12 16h.01'],
  },
  {
    key: 'align',
    label: 'Measure if AI gets you right',
    feature: 'Brand Ingestion',
    blurb: 'Feed AI your brand facts and see which ones the answers reflect, and which they miss.',
    anchor: '#tour-risks',
    icon: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  },
  {
    key: 'markets',
    label: 'Track every market & model',
    feature: 'Multi-LLM probing',
    blurb: 'Dozens of markets across every engine you track, sliced by topic — in a single run.',
    anchor: '#uc-probe',
    icon: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20', 'M12 2a15 15 0 0 0 0 20'],
  },
  {
    key: 'sources',
    label: 'See which sources feed answers',
    feature: 'Source Influence',
    blurb: 'The domains AI cites, ranked — and where your visibility can grow.',
    anchor: '#uc-source',
    icon: ['M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  },
  {
    key: 'record',
    label: 'Keep a record of what AI said',
    feature: 'Answer history',
    blurb: 'Every answer, verbatim, with its citations and timestamp — never pruned.',
    anchor: '#tour-answers',
    icon: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
  },
  {
    key: 'research',
    label: 'Find the conversation forming',
    feature: 'Brand Research',
    blurb: 'The live threads shaping the answer, and where you can join in.',
    anchor: '#tour-sources',
    icon: ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
  },
]

// Ordered by what sells the product first: the multi-engine scan, then the
// sources behind it, then brand safety, then the prompt set that feeds them.
const showcaseFeatures = [
  {
    key: 'probe',
    video: 'feature-2.mp4',
    fallbackVideo: 'watercolor-main.mp4',
    eyebrow: 'MULTI-LLM PROBING',
    headline: 'Run the same prompts across ChatGPT, Claude, Gemini, and Perplexity in one run.',
    desc: "We query every model in parallel, capture the raw responses, and extract every brand mention, citation, and claim. One score, four perspectives.",
    bullets: [
      'Parallel runs across all four target LLMs',
      'Extract brand mentions, citations, and claims',
      'One unified visibility score, four perspectives',
    ],
  },
  {
    key: 'source',
    video: 'feature-3.mp4',
    fallbackVideo: 'watercolor-second.mp4',
    eyebrow: 'SOURCE INFLUENCE',
    headline: 'The domains ranked, and where your visibility can grow.',
    desc: "Every citation behind every answer, aggregated by domain and ranked by how much of your category it decides. Each one shows which models lean on it and where your brand sits — so the places worth earning are the ones you are ranked lowest on, or missing from entirely.",
    bullets: [
      'Top cited domains ranked by share, each classified by type',
      'Per domain: which models cite it, and your position on it',
      'A shortlist of what to fix — pages AI cites that Google buries, and answers that skip you',
    ],
  },
  {
    key: 'security',
    video: 'feature-4.mp4',
    fallbackVideo: 'watercolor-main.mp4',
    eyebrow: 'BRAND SECURITY',
    headline: 'Catch the negative things AI says about your brand.',
    desc: "Every answer we collect is read for problems about you — negative sentiment, lukewarm endorsements, derogatory wording, unfavourable comparisons, claims that simply are not true, and private details surfacing where they should not. Each finding quotes the exact sentence that triggered it, so you can see what was said rather than a summary of it.",
    bullets: [
      'Nine checks run over every answer, each with a stable code you can track',
      'The flagged phrase is highlighted in place, in the answer it came from',
      'A queue you can filter by category and severity, and share by link',
    ],
  },
  {
    key: 'prompt',
    video: 'feature-1.mp4',
    fallbackVideo: 'market-back-ground.mp4',
    eyebrow: 'PROMPT LIBRARY',
    headline: 'Decide which questions you get measured on.',
    desc: "Large language models don't rank pages — they rank mentions. The Prompt Library is where you curate the questions that matter to your category, tag and group them, and set how often each one gets asked. Every prompt then carries its own result.",
    bullets: [
      'Add prompts one by one or import them in bulk, then group and tag',
      'Per prompt: which models answer it, which market, how often it reruns',
      'Visibility, average position, mentions and sentiment tracked per prompt',
    ],
  },
]

// Demand-side prompt examples — the typed search bar cycles through
// these one at a time; each becomes a row beneath with the data the
// Prompt Library actually surfaces in-product: monthly search volume,
// week-over-week delta, a tiny 8-week sparkline, and per-LLM coverage
// dots showing whether your brand appears in each model's answer today.
// Mirrors the columns the real Prompt Library table carries: tag, group,
// measured visibility / average position / mentions, the per-prompt model
// set, its market, and its cadence. Deliberately NO "monthly search volume"
// — the product has no such number, and claiming one on a marketing page
// would be inventing a metric.
const PROMPT_EXAMPLES = [
  {
    q: 'best ai analytics tool for small saas',
    tag: 'comparison', group: 'Category', country: 'US',
    visibility: 48, position: '3.2', mentions: '12 of 25 runs', nextRun: 'in 2 days',
    // true = your brand currently surfaces in this model's answer.
    models: { anthropic: true, openai: true, google: false, perplexity: true },
  },
  {
    q: 'how to track llm visibility in 2026',
    tag: 'how-to', group: 'Education', country: 'US',
    visibility: 31, position: '5.1', mentions: '8 of 25 runs', nextRun: 'in 5 days',
    models: { anthropic: true, openai: false, google: false, perplexity: true },
  },
  {
    q: 'cansee vs bluefish alternatives',
    tag: 'vs', group: 'Competitor', country: 'US',
    visibility: 72, position: '1.8', mentions: '18 of 25 runs', nextRun: 'tomorrow',
    models: { anthropic: true, openai: true, google: true, perplexity: true },
  },
  {
    q: 'why does perplexity keep mentioning notion',
    tag: 'question', group: 'Competitor', country: 'UK',
    visibility: 12, position: '8.4', mentions: '3 of 25 runs', nextRun: 'in 4 days',
    models: { anthropic: false, openai: false, google: false, perplexity: true },
  },
  {
    q: 'cheapest geo platform for an indie founder',
    tag: 'pricing', group: 'Category', country: 'DE',
    visibility: 22, position: '6.0', mentions: '5 of 25 runs', nextRun: 'in 6 days',
    models: { anthropic: true, openai: false, google: false, perplexity: false },
  },
  {
    q: 'is there a free chatgpt visibility tracker',
    tag: 'question', group: 'Category', country: 'US',
    visibility: 64, position: '2.4', mentions: '16 of 25 runs', nextRun: 'in 3 days',
    models: { anthropic: true, openai: true, google: true, perplexity: true },
  },
]

const MODEL_KEYS = ['anthropic', 'openai', 'google', 'perplexity']
const MODEL_LABEL = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
  google: 'Gemini',
  perplexity: 'Perplexity',
}

const pinnedPromptId = ref(null)
function togglePin(p) {
  pinnedPromptId.value = pinnedPromptId.value === p.id ? null : p.id
}
const coverageLabel = (p) => {
  const hit = MODEL_KEYS.filter(k => p.models?.[k]).length
  return `${hit} of 4 models surface you`
}

const typedPrompt = ref('')
const visiblePromptRows = ref([])

let _promptCycleStop = null
function startPromptCycle() {
  if (_promptCycleStop) return
  let idx = 0
  let cancelled = false
  let timer = null
  const typeIn = (target, speed) => new Promise(resolve => {
    let i = 0
    typedPrompt.value = ''
    const t = setInterval(() => {
      if (cancelled) { clearInterval(t); resolve(); return }
      i++
      typedPrompt.value = target.slice(0, i)
      if (i >= target.length) { clearInterval(t); resolve() }
    }, speed)
  })
  const wait = (ms) => new Promise(r => { timer = setTimeout(r, ms) })

  const waitWhilePinned = async () => {
    // Pause the loop while a row is pinned so a reader can study the
    // expanded detail. Poll every 250ms — cheap and only runs when paused.
    while (!cancelled && pinnedPromptId.value) {
      await new Promise(r => { timer = setTimeout(r, 250) })
    }
  }

  const loop = async () => {
    while (!cancelled) {
      await waitWhilePinned()
      if (cancelled) break
      const ex = PROMPT_EXAMPLES[idx]
      // Type the query into the search bar.
      await typeIn(ex.q, 45)
      if (cancelled) break
      await wait(520)
      // "Submit": clear the bar and drop the query into the results list
      // in the same tick, so the prompt is never shown in both places.
      const row = { ...ex, id: 'r-' + Date.now() + '-' + idx }
      typedPrompt.value = ''
      visiblePromptRows.value = [row, ...visiblePromptRows.value].slice(0, 3)
      await wait(1800)
      if (cancelled) break
      idx = (idx + 1) % PROMPT_EXAMPLES.length
    }
  }
  loop()
  _promptCycleStop = () => { cancelled = true; if (timer) clearTimeout(timer) }
}

// Source Influence demo data — every number is what the in-product table
// actually surfaces: per-provider share of citations by source class, the
// three sites most cited by each model, whether you appear in their top
// 25, and a one-line takeaway ("Perplexity leans on Reddit. You are not
// in their Reddit footprint.").
// Mirrors the real Sources/URLs page: citations aggregated per apex domain,
// each classified by domain type, with your own position on that domain and
// which models cite it. "What to do next" uses the three opportunity kinds
// the backend actually builds (apps/citations/services/url_opportunities.py).
const topDomains = [
  {
    domain: 'reddit.com', type: 'Community', share: 28, yourRank: null,
    citedBy: ['Perplexity', 'Claude', 'ChatGPT'],
    takeaway: 'Most-cited source in your category, and you are absent from it.',
  },
  {
    domain: 'wikipedia.org', type: 'Reference', share: 22, yourRank: null,
    citedBy: ['Claude', 'ChatGPT', 'Gemini'],
    takeaway: 'Claude leans on Wikipedia. No entry cites your brand.',
  },
  {
    domain: 'g2.com', type: 'Review', share: 14, yourRank: 4,
    citedBy: ['ChatGPT', 'Perplexity'],
    takeaway: 'You place 4th here — the cheapest position to improve.',
  },
  {
    domain: 'nytimes.com', type: 'News', share: 11, yourRank: null,
    citedBy: ['Gemini', 'ChatGPT'],
    takeaway: 'Gemini is news-first. Nothing here mentions you.',
  },
]

// Three of the nine real detectors, with the exact-phrase highlighting the
// product does via character-level evidence spans. Severities are only
// high / medium / low — there is no "critical" tier, and no health score.
const securityFindings = [
  {
    code: 'BS-SENT-001', category: 'Negative sentiment', model: 'Claude',
    severity: 'high', severityLabel: 'High',
    before: 'For most teams I would ',
    flagged: 'steer clear of Meterlane — support is slow and the pricing is opaque',
    after: '.',
  },
  {
    code: 'BS-FACT-001', category: 'Factual misrepresentation', model: 'ChatGPT',
    severity: 'high', severityLabel: 'High',
    before: 'Worth noting that ',
    flagged: 'Meterlane was acquired in 2024 and is no longer actively maintained',
    after: ', so migration may be a concern.',
  },
  {
    code: 'BS-COMP-001', category: 'Unfavourable comparison', model: 'Perplexity',
    severity: 'medium', severityLabel: 'Medium',
    before: 'Both are capable, though ',
    flagged: 'most teams end up choosing Linear over Meterlane',
    after: ' for anything beyond basic tracking.',
  },
]

const sourceOpportunities = [
  { title: 'AI cites you, Google buries you', count: '3 pages' },
  { title: 'AI answers skip your brand', count: '5 gaps' },
  { title: 'Working well', count: '2 pages' },
]

const domainRankLabel = (d) =>
  d.yourRank == null
    ? 'Your brand is not cited on this domain'
    : `Your brand ranks #${d.yourRank} among sources on this domain`

const pinnedSourceKey = ref(null)
function toggleSourcePin(s) {
  pinnedSourceKey.value = pinnedSourceKey.value === s.domain ? null : s.domain
}

/* ── FAQ items ── */
const faqItems = [
  { q: 'Is GEO just SEO with extra steps?',
    a: 'No. SEO ranks pages on Google. GEO ranks mentions inside LLM answers — different signals, different sources, different playbook.' },
  { q: 'How is this different from other GEO tools?',
    a: 'Most tools track rankings. We mine the prompts buyers actually ask, score the sources each LLM trusts, and show you exactly where to win citations — not just where you sit today.' },
  { q: 'Which LLMs do you track?',
    a: 'All the major ones your buyers are actually asking. New providers get added as they hit real usage.' },
  { q: 'Do I need to install anything on my site?',
    a: 'For LLM visibility tracking, no — add your domain and we start measuring from the outside in, the same way an LLM sees you. If you also want our web analytics (visitors, sessions, sources, conversions), drop in our lightweight pixel — it is one snippet and takes a minute. The pixel is optional and only powers the analytics side.' },
  { q: 'How often is the data refreshed?',
    a: "Prompts are re-run continuously, so visibility, sentiment, and citations reflect what LLMs are saying right now — not a snapshot from last week." },
  { q: 'How accurate are the citations?',
    a: "Every cited source is captured directly from the model's response and scored by influence, so you see not just what's cited but how much weight it carries." },
  { q: 'Can I share the data with my team or clients?',
    a: 'Yes. Send daily or weekly digests to Slack, Discord, or Microsoft Teams, and export your prompts and analytics events to CSV.' },
]

/* ── Animated count-up stats ── */
const STAT_TARGETS = [94, 40, 60]
const stat0 = ref(0)
const stat1 = ref(0)
const stat2 = ref(0)
const stat0Display = computed(() => Math.round(stat0.value).toString())
const stat1Display = computed(() => Math.round(stat1.value).toString())
const stat2Display = computed(() => Math.round(stat2.value).toString())
const statsSection = ref(null)
let statsAnimated = false

function animateStats() {
  if (statsAnimated) return
  statsAnimated = true
  const start = performance.now()
  const dur = 1600
  function frame(t) {
    const p = Math.min(1, (t - start) / dur)
    const eased = 1 - Math.pow(1 - p, 3)
    stat0.value = STAT_TARGETS[0] * eased
    stat1.value = STAT_TARGETS[1] * eased
    stat2.value = STAT_TARGETS[2] * eased
    if (p < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/* ── Sticky CTA visibility ── */
const showStickyCta = ref(false)
const finalCtaSection = ref(null)
let pastHero = false
let onFinalCta = false

function updateStickyCta() {
  showStickyCta.value = pastHero && !onFinalCta && !navOpen.value
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════
   Cansee landing — editorial cream-and-black system

   Two faces, and only two:
     · Instrument Serif 400 for display. Never bold. Line-height 1.1.
     · Inter 500 at 16/22.4 for absolutely everything else.

   Hierarchy comes from serif-vs-sans and from size jumps in the
   serif — never from bolding or shrinking the sans. There is no
   accent colour anywhere on this page by design.
   ═══════════════════════════════════════════════════════════ */

.lp {
  /* ground */
  --cream:        #fff9f0;
  --cream-alt:    #f5f3ee;
  --ink:          #000000;

  /* text */
  --on-ink:       #ffffff;
  --muted:        #474747;
  --muted-2:      #5c5c5c;
  --on-ink-mut:   #b0b0b0;
  --on-ink-dim:   #999999;

  /* lines */
  --hair:         rgba(0, 0, 0, .10);
  --hair-soft:    rgba(0, 0, 0, .06);
  --hair-ink:     rgba(255, 255, 255, .12);
  --hair-ink-2:   rgba(255, 255, 255, .22);

  /* a monochrome ramp so the four models stay tellable apart
     without reintroducing colour. Always paired with a text label. */
  --v-anthropic:  #ffffff;
  --v-openai:     #b0b0b0;
  --v-google:     #7a7a7a;
  --v-perplexity: #4a4a4a;

  /* type */
  --font-display: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* geometry */
  --r-media: 8px;
  --r-card: 16px;
  --r-pill: 32px;
  --sec-pad: 80px;

  /* motion */
  --ease: cubic-bezier(.22, 1, .36, 1);

  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  overflow-x: clip;
  -webkit-font-smoothing: antialiased;
}

/* ── Type scale ───────────────────────────────────────────── */

.lp h1, .lp h2, .lp h3 {
  font-family: var(--font-display);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0;
  margin: 0;
}
.lp h1 { font-size: 56px; }
.lp h2 { font-size: 44px; }
.lp h3 { font-size: 32px; }

/* Instrument Serif ships weight 400 and nothing else. Anything that
   borrows the display face must say 400 explicitly, or it inherits
   500 from .lp and the browser draws a synthetic bold. */
.step-num,
.stats-card-num, .stats-card-prefix, .stats-card-suffix,
.why-item-num, .why-demo-metric-value, .why-demo-metric-value small,
.mock-probe-score-num, .mock-probe-pct,
.nav-sheet a { font-weight: 400; }

.lp { font-synthesis-weight: none; }

/* Everything else inherits Inter 500 16/22.4 from .lp. Deliberately
   NOT a catch-all element list — `.lp div` would out-specify every
   single-class rule that sets a display size, which is the same
   cascade mistake utilities.css makes app-wide. Only the elements
   that don't inherit by default are reset. */
.lp button, .lp input, .lp select, .lp textarea { font: inherit; color: inherit; }
.lp small { font-size: inherit; }
.lp p { margin: 0; }
.lp ul, .lp ol { margin: 0; padding: 0; list-style: none; }

/* The two-tone device: the emphasised half of a heading steps back
   to the muted tone instead of taking an accent colour. */
em {
  font-style: normal;
  font-weight: inherit;
  color: var(--muted);
}
.lp .stats-card em,
.lp .final-cta em,
.lp .faq-aside em { color: var(--on-ink-mut); }

/* Inline emphasis inside body copy steps *forward* to full contrast
   rather than sideways into a hue. These need two classes to clear the
   surface rules above. */
.lp .why-demo-body em { color: var(--card-fg); font-weight: 600; }
.lp .mock-sec-alert-body em { color: var(--card-fg); font-weight: 600; }

strong { font-weight: 600; }

::selection { background: var(--ink); color: var(--cream); }
.lp .stats-card ::selection,
.lp .footer ::selection { background: var(--on-ink); color: var(--ink); }

/* Focus rings. Ink surfaces need the inverse or the ring is
   black-on-black and effectively invisible. */
.lp a:focus-visible,
.lp button:focus-visible,
.lp summary:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
  border-radius: 4px;
}
.footer a:focus-visible, .footer button:focus-visible,
.stats-card a:focus-visible,
.faq-aside a:focus-visible,
.final-cta a:focus-visible {
  outline-color: var(--on-ink);
}
/* The Get Started pill is the one ink surface inside the light nav. */
.nav .nav-cta:focus-visible { outline-color: var(--ink); outline-offset: 4px; }

.wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

.lp [id] { scroll-margin-top: 128px; }

/* ── Scroll reveal ────────────────────────────────────────────
   Fade and rise. Ends at transform:none so it never becomes the
   containing block for a position:sticky descendant. */
.anim {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity .7s var(--ease), transform .7s var(--ease);
}
.anim.in { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .lp *,
  .lp *::before,
  .lp *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
  .anim { opacity: 1; transform: none; }
}

/* ═══ Nav ═══════════════════════════════════════════════════
   At rest it is invisible chrome: no ground, sitting on the cream and
   aligned to the same container as the hero, so the wordmark lines up
   with the H1. On scroll it contracts into a white pill and lifts off
   the page. Everything in it stays ink in both states except the
   Get Started button, which inverts to solid black once the ground
   turns white — it is the one thing that has to keep popping. */

.nav {
  position: fixed;
  top: 24px;
  left: 0;
  right: 0;
  z-index: 90;
  display: flex;
  justify-content: center;
  padding: 0 24px;
  pointer-events: none;
}
.nav > * { pointer-events: auto; }

.nav-pill {
  display: flex;
  align-items: center;
  gap: 32px;
  width: 100%;
  max-width: 1200px;
  height: 64px;
  padding: 0 24px;
  background: transparent;
  border-radius: 40px;
  transition: max-width .45s var(--ease), background .3s ease,
              box-shadow .35s var(--ease), padding .45s var(--ease);
}
.nav.scrolled .nav-pill {
  max-width: 880px;
  padding: 0 12px 0 24px;
  background: #ffffff;
  box-shadow: 0 6px 28px rgba(0, 0, 0, .10);
}

.brand { display: flex; align-items: center; gap: 8px; text-decoration: none; flex: 0 0 auto; }
.brand-logo { height: 22px; width: auto; object-fit: contain; }
.brand-beta { font-size: 16px; color: var(--muted-2); }

.nav-links { display: flex; align-items: center; gap: 28px; margin-left: auto; }
.nav-links a { color: var(--ink); text-decoration: none; transition: opacity .2s ease; }
.nav-links a:hover { opacity: .55; }

/* ── Use Cases mega-menu ── */
.nav-uc { position: relative; display: flex; align-items: center; }
.nav-uc-trigger { display: inline-flex; align-items: center; gap: 5px; }
.nav-uc-caret { opacity: .7; transition: transform .25s var(--ease); }
.nav-uc:hover .nav-uc-caret,
.nav-uc:focus-within .nav-uc-caret { transform: rotate(180deg); }

.nav-uc-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  margin-top: 14px;
  width: 620px;
  max-width: min(92vw, 620px);
  background: var(--cream);
  border: 1px solid var(--hair);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .16);
  padding: 18px;
  text-align: left;
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(8px);
  pointer-events: none;
  transition: opacity .22s var(--ease), transform .22s var(--ease), visibility .22s;
  z-index: 100;
}
/* Invisible bridge across the gap so the panel doesn't drop mid-reach. */
.nav-uc-panel::before { content: ''; position: absolute; top: -16px; left: 0; right: 0; height: 16px; }
.nav-uc:hover .nav-uc-panel,
.nav-uc:focus-within .nav-uc-panel {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.nav-uc-eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted-2);
  padding: 2px 8px 12px;
}
.nav-uc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.nav-links .nav-uc-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 11px 10px;
  border-radius: 12px;
  transition: background .16s ease;
}
.nav-links .nav-uc-item:hover { background: var(--cream-alt); opacity: 1; }
.nav-uc-ic {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--cream-alt);
  color: var(--ink);
  transition: background .16s ease, color .16s ease;
}
.nav-uc-item:hover .nav-uc-ic { background: var(--ink); color: var(--on-ink); }
.nav-uc-txt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.nav-uc-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.2;
}
.nav-uc-tag {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted);
  background: var(--hair-soft);
  padding: 1px 7px;
  border-radius: 999px;
  white-space: nowrap;
}
.nav-uc-blurb { font-size: 12.5px; color: var(--muted); line-height: 1.4; }

.nav-links .nav-uc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 13px 12px 4px;
  border-top: 1px solid var(--hair);
  font-size: 13px;
  color: var(--muted);
}
.nav-links .nav-uc-foot:hover { opacity: 1; }
.nav-uc-foot-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}
.nav-uc-foot:hover .nav-uc-foot-link { text-decoration: underline; }

/* Mobile sheet: a compact use-case list above the big display links. */
.nav-sheet-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted-2);
  padding: 12px 4px 2px;
}
.nav-sheet .nav-sheet-uc {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  padding: 8px 4px;
  color: var(--ink);
}
.nav-sheet { max-height: calc(100vh - 100px); overflow-y: auto; }

.nav-right { display: flex; align-items: center; gap: 16px; margin-left: auto; }
.nav-link-text { color: var(--ink); text-decoration: none; transition: opacity .2s ease; }
.nav-link-text:hover { opacity: .55; }

/* Resting: a quiet light pill with an outlined arrow, as in the
   reference. Scrolled: solid ink so it still reads against white. */
.nav-cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 6px 0 18px;
  background: var(--cream-alt);
  color: var(--ink);
  text-decoration: none;
  border-radius: var(--r-pill);
  white-space: nowrap;
  transition: background .3s ease, color .3s ease;
}
.nav-cta-arrow {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  color: inherit;
  transition: transform .35s var(--ease), background .3s ease,
              border-color .3s ease, color .3s ease;
}
.nav-cta:hover .nav-cta-arrow { transform: translate(2px, -2px); }

.nav.scrolled .nav-cta { background: var(--ink); color: var(--on-ink); }
.nav.scrolled .nav-cta-arrow {
  background: var(--on-ink);
  border-color: var(--on-ink);
  color: var(--ink);
}

/* burger */
.nav-burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 44px;
  height: 44px;
  margin-left: auto;
  padding: 0 10px;
  background: none;
  border: 0;
  cursor: pointer;
}
.nav-burger-bar {
  display: block;
  height: 1.5px;
  width: 100%;
  background: var(--ink);
  transition: transform .35s var(--ease), opacity .2s ease;
}
.nav-burger[aria-expanded="true"] .nav-burger-bar:first-child { transform: translateY(3.25px) rotate(45deg); }
.nav-burger[aria-expanded="true"] .nav-burger-bar:last-child { transform: translateY(-3.25px) rotate(-45deg); }

/* sheet — `inert` (bound in the template) owns tab order and focus;
   CSS only animates. Deliberately no visibility transition: it leaves
   the element unfocusable for a frame, so focus() on open silently
   fails. */
.nav-sheet {
  position: absolute;
  top: 76px;
  left: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .12);
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  transition: opacity .25s ease, transform .35s var(--ease);
}
.nav-sheet.is-open { opacity: 1; transform: none; pointer-events: auto; }
.nav-sheet a {
  padding: 12px 4px;
  font-family: var(--font-display);
  font-size: 32px;
  line-height: 1.1;
  color: var(--ink);
  text-decoration: none;
}
/* These two must out-specify `.nav-sheet a` above, which would
   otherwise force both to display-face white. */
.nav-sheet .nav-sheet-login,
.nav-sheet .nav-sheet-cta {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
}
.nav-sheet .nav-sheet-login {
  color: var(--muted);
  border-top: 1px solid var(--hair);
  margin-top: 12px;
  padding-top: 16px;
}
.nav-sheet .nav-sheet-cta {
  margin-top: 8px;
  text-align: center;
  background: var(--ink);
  color: var(--on-ink);
  border-radius: var(--r-pill);
  padding: 12px 18px;
}

/* ═══ Hero ══════════════════════════════════════════════════ */

.hero { padding: 168px 0 40px; }
.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: stretch;
}
.hero-left {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 460px;
  gap: 40px;
}
/* 21ch clears the longest line ("FOR THE AGENTIC ERA." needs ~20ch) so the
   four explicit <br/> breaks are the only breaks. In ch, so it holds
   as the display size steps down at the breakpoints. */
.hero-h { max-width: 21ch; }
.hero-p { max-width: 500px; color: var(--muted); }
.hero-sub { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
.hero-tour-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}
.hero-tour-link:hover { text-decoration-thickness: 2px; }

.hero-word-cycler {
  display: inline-grid;
  vertical-align: bottom;
  overflow: hidden;
  height: 1.4em;
}
.hero-word { grid-area: 1 / 1; color: var(--ink); }
.word-cycle-enter-active, .word-cycle-leave-active { transition: opacity .4s ease, transform .4s var(--ease); }
.word-cycle-enter-from { opacity: 0; transform: translateY(100%); }
.word-cycle-leave-to { opacity: 0; transform: translateY(-100%); }

/* Hero media.
   The photograph is 3:2 and the reference's hero column is nearly
   square, so a full-height cover crop would slice the car's nose off.
   460px keeps both columns balanced while leaving the whole subject
   inside the frame. */
.hero-right { display: flex; }
.hero-media {
  width: 100%;
  height: 100%;
  min-height: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: var(--r-media);
  display: block;
}

/* ═══ Trust strip ═══════════════════════════════════════════ */

.trust { background: var(--cream-alt); }
.trust-row {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 28px;
}
.trust-label { color: var(--muted); }
.trust-item { color: var(--ink); }

/* ═══ Why this exists ═══════════════════════════════════════ */

.why { padding: var(--sec-pad) 0; }
.why-split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.why-h { margin-bottom: 20px; }
.why-h-quiet { color: var(--muted); }
.why-sub { max-width: 500px; color: var(--muted); margin-bottom: 32px; }

.why-list { border-top: 1px solid var(--hair); }
.why-row { border-bottom: 1px solid var(--hair); }
.why-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 48px;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 20px 0;
  background: none;
  border: 0;
  text-align: left;
  cursor: pointer;
  color: var(--muted);
  transition: color .2s ease;
}
.why-item:hover, .why-item.is-active { color: var(--ink); }
.why-item-num { font-family: var(--font-display); font-size: 20px; color: inherit; }
.why-item-label { color: inherit; }
.why-item-arrow {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--hair);
  border-radius: 50%;
  color: inherit;
  transition: transform .35s var(--ease), background .2s ease, border-color .2s ease;
}
.why-item:hover .why-item-arrow,
.why-item.is-active .why-item-arrow {
  transform: translate(2px, -2px);
  background: var(--ink);
  border-color: var(--ink);
  color: var(--on-ink);
}

/* Same light card as the feature mocks, but there is no video well
   behind this one — so it carries a visible hairline and a softer
   shadow to separate itself from the cream. */
.why-panel {
  padding: 24px;
  background: #fffcf7;
  border: 1px solid var(--card-hair);
  border-radius: var(--r-card);
  box-shadow: 0 14px 40px rgba(0, 0, 0, .07);
  min-height: 420px;
  display: flex;
  color: var(--card-fg);
}
.why-demo { width: 100%; }
.why-demo-panel { display: flex; flex-direction: column; gap: 16px; height: 100%; }
.why-demo-fade-enter-active, .why-demo-fade-leave-active { transition: opacity .3s ease, transform .3s var(--ease); }
.why-demo-fade-enter-from { opacity: 0; transform: translateY(8px); }
.why-demo-fade-leave-to { opacity: 0; transform: translateY(-8px); }

.why-demo-head { display: flex; align-items: center; gap: 10px; color: var(--card-fg); }
.why-demo-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--card-fg) !important; /* overrides the inline hue */
}
.why-demo-body { color: var(--card-mut); }
.why-demo-list { counter-reset: d; margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.why-demo-list li {
  counter-increment: d;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--card-hair);
  color: var(--card-mut);
}
.why-demo-list li::before { content: counter(d) '.'; color: var(--card-dim); min-width: 18px; }
.why-demo-list li.hi { color: var(--card-fg); }
.why-demo-you { color: var(--card-fg) !important; }
.why-demo-you-tag {
  display: inline-flex; align-items: center; gap: 6px;
  margin-left: auto; padding: 3px 10px;
  border: 1px solid var(--card-hair-2); border-radius: var(--r-pill);
  color: var(--card-fg); white-space: nowrap;
}
.why-demo-foot { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--card-hair); color: var(--card-dim); }
.why-demo-foot strong { color: var(--card-fg); }

.why-demo-metric { display: flex; flex-direction: column; gap: 4px; }
.why-demo-metric-value { font-family: var(--font-display); font-size: 44px; line-height: 1.1; color: var(--card-fg); }
.why-demo-metric-value small { font-family: var(--font-display); font-size: 24px; color: var(--card-dim); }
.why-demo-metric-label { color: var(--card-mut); }
.why-demo-bars { display: flex; flex-direction: column; gap: 10px; }
.why-demo-bar-row { display: grid; grid-template-columns: 84px 1fr auto; align-items: center; gap: 12px; }
.why-demo-bar-row .lbl { color: var(--card-mut); }
.why-demo-bar-row .bar { height: 8px; border-radius: 20px; background: var(--card-track); overflow: hidden; }
.why-demo-bar-row .bar > span { display: block; height: 100%; background: var(--card-fg); border-radius: 20px; }
.why-demo-bar-row .val { color: var(--card-dim); }

.why-cta {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 16px;
  margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--hair);
}
.why-cta-line { color: var(--muted); }
.why-cta-line strong { color: var(--ink); }
.why-cta-btn {
  display: inline-flex; align-items: center; gap: 10px;
  height: 42px; padding: 0 18px;
  background: var(--ink); color: var(--on-ink);
  border-radius: var(--r-pill); text-decoration: none;
  transition: opacity .2s ease;
}
.why-cta-btn:hover { opacity: .85; }
.why-cta-btn svg { transition: transform .35s var(--ease); }
.why-cta-btn:hover svg { transform: translateX(3px); }

/* ═══ Stats card ════════════════════════════════════════════ */

.stats { padding: var(--sec-pad) 0; }
.stats-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--ink);
  padding: 48px;
  isolation: isolate;
  /* Tall enough that the footage is the subject and the type sits on top
     of it, instead of three dense columns filling the frame. */
  min-height: 74vh;
  display: flex;
}
.stats-card-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  z-index: -2;
}
.stats-card-tint { position: absolute; inset: 0; background: rgba(0, 0, 0, .72); z-index: -1; }
/* space-between, not a fixed gap: the empty middle is the point. The
   heading holds the top, the metrics sit on the floor, and everything
   between is the video. */
.stats-card-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  gap: 40px;
  width: 100%;
}
.stats-card-top { display: grid; grid-template-columns: 1fr 400px; gap: 24px; align-items: start; }
.stats-card-h { color: var(--on-ink); }
.stats-card-sub { color: var(--on-ink-mut); }
/* Reference row, deliberately small. The numbers still lead, but the
   supporting copy is footnote scale so the block reads as a citation
   strip along the bottom rather than a third column of content. */
.stats-card-bottom {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  max-width: 780px;
}
.stats-card-metric { display: flex; flex-direction: column; gap: 2px; }
.stats-card-num {
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1.05;
  color: var(--on-ink);
}
.stats-card-prefix, .stats-card-suffix { font-family: var(--font-display); }
.stats-card-label { margin-top: 4px; font-size: 11.5px; font-weight: 600; color: var(--on-ink); }
.stats-card-note { font-size: 10.5px; line-height: 1.4; color: var(--on-ink-mut); }
.stats-card-cite {
  margin-top: 3px;
  font-size: 10px;
  color: var(--on-ink-dim);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color .2s ease;
}
.stats-card-cite:hover { color: var(--on-ink); }

/* ═══ Feature showcase ══════════════════════════════════════ */

.feature-showcase { padding: var(--sec-pad) 0; display: flex; flex-direction: column; }
.feature-showcase .wrap { display: flex; flex-direction: column; gap: 96px; }
.feature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center; }
.feature-row.is-reverse .feature-copy { order: 2; }

.feature-copy { display: flex; flex-direction: column; gap: 20px; }
.feature-eyebrow { color: var(--muted); }
.feature-h { font-family: var(--font-display); font-size: 44px; line-height: 1.1; font-weight: 400; }
.feature-desc { color: var(--muted); max-width: 500px; }
.feature-bullets { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--hair); padding-top: 20px; }
.feature-bullets li { display: flex; align-items: baseline; gap: 12px; color: var(--muted); }
.feature-bullet-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ink); flex: 0 0 auto; transform: translateY(-3px); }

/* The video is the media well; the mock floats on it so the
   watercolor frames the card rather than hiding behind it. */
.feature-visual {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-card);
  background: var(--ink);
  padding: 24px;
  min-height: 420px;
  display: flex;
  isolation: isolate;
}
.feature-visual-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  z-index: -2;
}
/* Light enough that the watercolor still reads as colour in the band
   around the card — the video is meant to be seen, not just implied. */
.feature-visual-tint { position: absolute; inset: 0; background: rgba(0, 0, 0, .28); z-index: -1; }

/* Light-card token set. Every product panel on the page — the four
   feature mocks and the "why this exists" demo — reads its tones off
   these rather than the page's on-ink set, so the whole family flips
   light or dark from one place. */
.mock-card,
.why-panel {
  --card-fg: var(--ink);
  --card-mut: var(--muted);
  --card-dim: var(--muted-2);
  --card-hair: rgba(0, 0, 0, .10);
  --card-hair-2: rgba(0, 0, 0, .20);
  --card-wash: rgba(0, 0, 0, .035);
  --card-wash-2: rgba(0, 0, 0, .06);
  --card-track: rgba(0, 0, 0, .10);

  /* Provider ramp, re-cut for a light ground. Still monochrome, still
     always paired with a text label. */
  --v-anthropic: #000000;
  --v-openai: #4a4a4a;
  --v-google: #7a7a7a;
  --v-perplexity: #adadad;
}

/* The mock is a near-opaque light card floating on the video well. */
.mock-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: rgba(255, 252, 247, .95);
  border: 1px solid rgba(255, 255, 255, .55);
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .18);
  color: var(--card-fg);
}

/* — shared mock atoms — */
.mock-detail-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--card-hair); }
.mock-detail-label { color: var(--card-dim); }
.mock-detail-value { color: var(--card-fg); text-align: right; }
.mock-detail-status { color: var(--card-dim); margin-left: auto; }

.mock-model-dot,
.mock-source-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid var(--card-dim);
  flex: 0 0 auto;
}
.mock-model-dot.is-hit { background: var(--card-fg); border-color: var(--card-fg); }
.mock-source-dot.is-anthropic  { background: var(--v-anthropic);  border-color: var(--v-anthropic); }
.mock-source-dot.is-openai     { background: var(--v-openai);     border-color: var(--v-openai); }
.mock-source-dot.is-google     { background: var(--v-google);     border-color: var(--v-google); }
.mock-source-dot.is-perplexity { background: var(--v-perplexity); border-color: var(--card-dim); }

/* — Prompt Library — */
.mock-search { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--card-wash); border: 1px solid var(--card-hair); border-radius: 10px; }
.mock-search-icon { width: 12px; height: 12px; border: 1.5px solid var(--card-dim); border-radius: 50%; position: relative; flex: 0 0 auto; }
.mock-search-icon::after { content: ''; position: absolute; right: -4px; bottom: -3px; width: 5px; height: 1.5px; background: var(--card-dim); transform: rotate(45deg); }
.mock-search-text { color: var(--card-fg); }
.mock-search-caret { color: var(--card-fg); animation: caret-blink 1.1s step-end infinite; }
@keyframes caret-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }

.mock-rows { display: flex; flex-direction: column; }
.mock-prompt-row { padding: 12px 0; border-bottom: 1px solid var(--card-hair); cursor: pointer; animation: mock-row-in .45s var(--ease) both; }
.mock-prompt-row:hover { background: var(--card-wash); }
.mock-prompt-row.is-pinned { background: var(--card-wash-2); }
@keyframes mock-row-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.mock-row-stagger-enter-active, .mock-row-stagger-leave-active { transition: opacity .3s ease, transform .3s var(--ease); }
.mock-row-stagger-enter-from, .mock-row-stagger-leave-to { opacity: 0; transform: translateY(6px); }

.mock-prompt-main { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.mock-q { color: var(--card-fg); }
.mock-chip { padding: 2px 10px; border: 1px solid var(--card-hair-2); border-radius: var(--r-pill); color: var(--card-dim); white-space: nowrap; }
.mock-prompt-meta { display: flex; align-items: center; gap: 14px; margin-top: 8px; color: var(--card-dim); }
.mock-metric { color: var(--card-dim); white-space: nowrap; }
.mock-metric b { color: var(--card-fg); font-weight: 600; }
.mock-lib-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mock-lib-title { color: var(--card-fg); }
.mock-lib-count { color: var(--card-dim); margin-left: 6px; }
.mock-lib-tools { display: flex; gap: 6px; }
.mock-models { display: inline-flex; gap: 5px; margin-left: auto; }
.mock-prompt-detail { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--card-hair); }
.mock-detail-models { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.mock-detail-models li { display: flex; align-items: center; gap: 10px; color: var(--card-mut); }
.mock-detail-models li.is-hit { color: var(--card-fg); }

/* — Multi-LLM Probing — */
.mock-probe-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--card-hair); }
.mock-probe-title { color: var(--card-fg); }
.mock-probe-sub { color: var(--card-dim); }
.mock-probe-score { text-align: right; flex: 0 0 auto; }
.mock-probe-score-num { display: block; font-family: var(--font-display); font-size: 32px; line-height: 1.1; color: var(--card-fg); }
.mock-probe-score-label { color: var(--card-dim); }
.mock-probe-grid { display: flex; flex-direction: column; }
.mock-probe-card { padding: 12px 0; border-bottom: 1px solid var(--card-hair); cursor: pointer; animation: mock-row-in .45s var(--ease) both; }
.mock-probe-card:hover { background: var(--card-wash); }
.mock-probe-card.is-pinned { background: var(--card-wash-2); }
.mock-probe-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mock-probe-name { display: inline-flex; align-items: center; gap: 8px; color: var(--card-fg); }
.mock-probe-pct { font-family: var(--font-display); font-size: 20px; color: var(--card-fg); }
.mock-probe-bar { height: 8px; margin: 8px 0; border-radius: 20px; background: var(--card-track); overflow: hidden; }
.mock-probe-bar-fill { height: 100%; width: var(--target-w, 0%); border-radius: 20px; background: var(--card-fg); animation: bar-grow .8s var(--ease) both; }
.mock-probe-bar-fill.is-anthropic  { background: var(--v-anthropic); }
.mock-probe-bar-fill.is-openai     { background: var(--v-openai); }
.mock-probe-bar-fill.is-google     { background: var(--v-google); }
.mock-probe-bar-fill.is-perplexity { background: var(--v-perplexity); }
@keyframes bar-grow { from { width: 0 } }
.mock-probe-stats { display: flex; align-items: center; gap: 14px; color: var(--card-dim); }
.mock-probe-delta { color: var(--card-mut); }
.mock-probe-stat { color: var(--card-dim); }
.mock-probe-detail { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--card-hair); }
.mock-probe-sent { display: inline-flex; width: 120px; height: 8px; border-radius: 20px; overflow: hidden; }
.mock-probe-sent-seg { width: var(--w); height: 100%; }
.mock-probe-sent-seg.pos { background: var(--card-fg); }
.mock-probe-sent-seg.neu { background: var(--card-dim); }
.mock-probe-sent-seg.neg { background: var(--card-track); }
.mock-probe-comp { color: var(--card-dim); }
.mock-probe-safety { color: var(--card-fg); }
.mock-probe-safety.is-warn { color: var(--card-mut); }

/* — Source Influence — */
.mock-source-head { padding-bottom: 12px; border-bottom: 1px solid var(--card-hair); }
.mock-source-title { color: var(--card-fg); }
.mock-source-sub { color: var(--card-dim); }
.mock-source-row { padding: 12px 0; border-bottom: 1px solid var(--card-hair); cursor: pointer; animation: mock-row-in .45s var(--ease) both; }
.mock-source-row:hover { background: var(--card-wash); }
.mock-source-row.is-pinned { background: var(--card-wash-2); }
.mock-source-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.mock-source-label { display: inline-flex; align-items: center; gap: 8px; color: var(--card-fg); }
.mock-source-rank { color: var(--card-fg); }
.mock-source-rank.is-miss { color: var(--card-dim); }
.mock-rank-num { display: inline-block; min-width: 14px; color: var(--card-dim); }
.mock-stack { display: flex; align-items: center; gap: 10px; }
.mock-stack > .mock-seg { height: 8px; border-radius: 20px; background: var(--card-fg); width: var(--target-w, 0%); max-width: 100%; animation: bar-grow .8s var(--ease) both; }
.mock-share-pct { color: var(--card-dim); flex: 0 0 auto; }
.mock-next { margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--card-hair); }
.mock-next-title { color: var(--card-fg); margin-bottom: 8px; }
.mock-next-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
.mock-next-label { color: var(--card-mut); }
.mock-next-count { color: var(--card-dim); white-space: nowrap; }
.mock-source-detail { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--card-hair); }
.mock-source-domain { color: var(--card-fg); }
.mock-source-takeaway { color: var(--card-mut); }

/* — Brand Security — */
.mock-sec-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--card-hair); }
.mock-sec-title { color: var(--card-fg); }
.mock-sec-count { color: var(--card-dim); white-space: nowrap; }
.mock-sec-quote { margin: 0; color: var(--card-mut); }
/* The flagged span, highlighted in place — this is the whole point of the
   finding, so it gets the ink treatment rather than a colour wash. */
.mock-sec-flag { background: var(--card-wash-2); color: var(--card-fg); box-shadow: inset 0 -1px 0 var(--card-fg); padding: 0 1px; }
.mock-sec-alerts { display: flex; flex-direction: column; }
.mock-sec-alert { padding: 12px 0; border-bottom: 1px solid var(--card-hair); animation: mock-row-in .45s var(--ease) both; }
.mock-sec-alert-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mock-sec-meta { color: var(--card-dim); margin: 2px 0 6px; }
.mock-sec-agent { color: var(--card-fg); }
.mock-sec-src, .mock-sec-time { color: var(--card-dim); }
.mock-sec-sev { flex: 0 0 auto; padding: 2px 10px; border-radius: var(--r-pill); border: 1px solid var(--card-hair-2); color: var(--card-mut); white-space: nowrap; }
.mock-sec-sev.is-high { background: var(--card-fg); border-color: var(--card-fg); color: var(--cream); }
.mock-sec-sev.is-medium { border-color: var(--card-hair-2); color: var(--card-mut); }
.mock-sec-alert-body { color: var(--card-mut); }


/* ═══ How it works ══════════════════════════════════════════ */

.how { padding: var(--sec-pad) 0; }
.sec-h { margin-bottom: 40px; }
.steps { border-top: 1px solid var(--hair); }
.step {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 1fr;
  gap: 24px;
  align-items: baseline;
  padding: 24px 0;
  border-bottom: 1px solid var(--hair);
}
.step-num { font-family: var(--font-display); font-size: 32px; line-height: 1.1; color: var(--muted); }
.step h3 { font-size: 32px; }
.step p { color: var(--muted); }

/* ═══ FAQ ═══════════════════════════════════════════════════ */

.faq { padding: var(--sec-pad) 0; }
.faq-wrap { display: grid; grid-template-columns: 420px minmax(0, 1fr); gap: 48px; align-items: start; }
.faq-aside {
  position: sticky;
  top: 120px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 32px;
  background: var(--ink);
  border-radius: var(--r-card);
}
.faq-eyebrow { color: var(--on-ink-dim); }
.faq-h { color: var(--on-ink); }
.faq-aside-btn {
  align-self: flex-start;
  display: inline-flex; align-items: center;
  height: 42px; padding: 0 22px;
  margin-top: 8px;
  background: var(--cream); color: var(--ink);
  border-radius: var(--r-pill); text-decoration: none;
  transition: opacity .2s ease;
}
.faq-aside-btn:hover { opacity: .88; }

.faq-list { border-top: 1px solid var(--hair); }
.faq-item { border-bottom: 1px solid var(--hair); }
.faq-item summary {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 22px 0;
  cursor: pointer;
  list-style: none;
  color: var(--ink);
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-plus {
  position: relative;
  width: 12px; height: 12px;
  flex: 0 0 auto;
  transition: transform .35s var(--ease);
}
.faq-plus::before, .faq-plus::after {
  content: ''; position: absolute; left: 0; top: 5px;
  width: 8px; height: 1.5px; background: var(--ink);
}
.faq-plus::before { transform: rotate(45deg); transform-origin: left center; }
.faq-plus::after { left: auto; right: 0; transform: rotate(-45deg); transform-origin: right center; }
.faq-item[open] .faq-plus { transform: rotate(180deg); }
.faq-a { padding-bottom: 22px; max-width: 60ch; }
.faq-a p { color: var(--muted); }
.faq-item[open] .faq-a { animation: faq-open .35s var(--ease) both; }
@keyframes faq-open { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }

/* ═══ Final CTA — the crown on the footer ═══════════════════ */

.final-cta {
  position: relative;
  overflow: hidden;
  background: var(--ink);
  padding: 120px 0 100px;
  isolation: isolate;
  text-align: center;
}
.final-cta-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  z-index: -2;
}
.final-cta-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, .74); z-index: -1; }
.final-cta-glow { display: none; }
.cta-inner { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.final-cta h2 { color: var(--on-ink); max-width: 18ch; }
.final-cta p { color: var(--on-ink-mut); }
.btn-primary {
  display: inline-flex; align-items: center;
  height: 42px; padding: 0 26px; margin-top: 8px;
  background: var(--cream); color: var(--ink);
  border-radius: var(--r-pill); text-decoration: none;
  transition: opacity .2s ease, transform .35s var(--ease);
}
.btn-primary:hover { opacity: .9; transform: translateY(-2px); }

/* ═══ Sticky CTA pill ═══════════════════════════════════════ */

.sticky-cta {
  position: fixed;
  right: 24px; bottom: 24px;
  z-index: 80;
  display: inline-flex; align-items: center; gap: 10px;
  height: 46px; padding: 0 20px;
  background: var(--ink); color: var(--on-ink);
  border-radius: var(--r-pill); text-decoration: none;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .2);
  transition: transform .35s var(--ease);
}
.sticky-cta:hover { transform: translateY(-2px); }
.sticky-cta-enter-active, .sticky-cta-leave-active { transition: opacity .3s ease, transform .35s var(--ease); }
.sticky-cta-enter-from, .sticky-cta-leave-to { opacity: 0; transform: translateY(12px); }

/* ═══ Footer ════════════════════════════════════════════════ */

.footer { background: var(--ink); padding: 80px 0 24px; color: var(--on-ink-mut); }
.footer-grid { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); gap: 40px 24px; padding-bottom: 48px; border-bottom: 1px solid var(--hair-ink); }
.footer-brand { margin-bottom: 16px; }
.footer-logo { height: 22px; width: auto; filter: invert(1) grayscale(1) brightness(2); }
.footer-tagline { color: var(--on-ink-mut); max-width: 34ch; margin-bottom: 20px; }
.footer-socials { display: flex; gap: 10px; }
.footer-social {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border: 1px solid var(--hair-ink); border-radius: 50%;
  color: var(--on-ink-mut);
  transition: color .2s ease, border-color .2s ease;
}
.footer-social:hover { color: var(--on-ink); border-color: var(--on-ink); }
.footer-col { display: flex; flex-direction: column; gap: 12px; }
.footer-col-title { font-size: 24px; line-height: 1.2; color: var(--on-ink); margin-bottom: 4px; }
.footer-col a { color: var(--on-ink-mut); text-decoration: none; transition: color .2s ease; }
.footer-col a:hover { color: var(--on-ink); }
/* "Cookie settings" reopen — a button, styled to read as a footer link. */
.footer-link-btn {
  color: var(--on-ink-mut);
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: color .2s ease;
}
.footer-link-btn:hover { color: var(--on-ink); }
.footer-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 24px; }
.footer-copy { color: var(--on-ink-dim); }
.footer-meta { display: flex; align-items: center; gap: 10px; color: var(--on-ink-dim); }
.footer-meta-item { display: inline-flex; align-items: center; gap: 8px; }
.footer-status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--on-ink); }
.footer-meta-divider { color: var(--on-ink-dim); }

/* ═══ Responsive — two breakpoints only ═════════════════════ */

@media (max-width: 1023px) {
  .lp h1 { font-size: 48px; }
  .lp h2, .feature-h, .step h3 { font-size: 32px; }
  .lp { --sec-pad: 56px; }

  .nav { top: 16px; }
  .nav-pill { height: 60px; padding: 0 8px 0 20px; }
  .nav-links, .nav-right { display: none; }
  .nav-burger { display: flex; }

  .hero { padding: 128px 0 40px; }
  .hero-grid, .why-split, .feature-row, .stats-card-top, .faq-wrap { grid-template-columns: 1fr; }
  .hero-left { min-height: 0; gap: 28px; }
  .feature-row.is-reverse .feature-copy { order: 0; }
  .feature-showcase .wrap { gap: 64px; }
  .stats-card { padding: 32px; }
  .stats-card-content { gap: 40px; }
  .stats-card-bottom { grid-template-columns: 1fr; gap: 20px; }
  .faq-wrap { gap: 32px; }
  .faq-aside { position: static; }
  .step { grid-template-columns: 40px minmax(0, 1fr); gap: 8px 16px; }
  .step p { grid-column: 2; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .final-cta { padding: 88px 0 72px; }
}

@media (max-width: 767px) {
  .lp h1 { font-size: 40px; }
  .lp { --sec-pad: 48px; }
  .wrap, .trust-row { padding-left: 16px; padding-right: 16px; }
  .nav { padding: 0 16px; }
  .nav-sheet { left: 16px; right: 16px; }
  .nav-sheet a { font-size: 28px; }

  .hero { padding: 112px 0 32px; }
  .probe-grid { grid-template-columns: 1fr; }
  .probe-card { transform: none; }

  .why-item { grid-template-columns: auto minmax(0, 1fr); gap: 12px; padding: 16px 0; }
  .why-item-arrow { display: none; }
  .why-panel { padding: 20px; min-height: 0; }
  .why-cta { flex-direction: column; align-items: flex-start; }

  .stats-card { padding: 24px; }
  .stats-card-num, .why-demo-metric-value { font-size: 36px; }

  .feature-visual { padding: 16px; min-height: 340px; }
  .mock-card { padding: 16px; gap: 12px; }
  .mock-prompt-meta { flex-wrap: wrap; gap: 10px; }
  .mock-models { margin-left: 0; }

  .faq-aside { padding: 24px; }
  .final-cta { padding: 72px 0 56px; }
  .footer-grid { grid-template-columns: 1fr; gap: 32px; }
  .sticky-cta { right: 16px; bottom: 16px; }
}
</style>

<style>
/* Unscoped, but every selector is gated on the landing page being
   mounted so nothing here leaks to the rest of the app. */
html:has(.lp) {
  /* The pre-paint theme bootstrap writes color-scheme onto <html> as an
     inline style, which a plain rule cannot beat. This page is
     deliberately light-only, so the scrollbar has to follow it even
     when the rest of the app is in dark mode. */
  color-scheme: light !important;
}
html:has(.lp),
html:has(.lp) body,
html:has(.lp) #app {
  overflow-x: clip;
  max-width: 100vw;
  /* The cream has to reach the overscroll area, not stop at .lp's box. */
  background: #fff9f0;
}
/* No scroll-behavior here: base.css already sets it on html globally,
   along with its prefers-reduced-motion override. */
</style>
