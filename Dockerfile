# ── Stage 1: Build Vue app ──
# npm run build runs scripts/prerender-blog.mjs, which uses jsdom; jsdom
# needs Node ^22.22.2 (it calls Promise.withResolvers, absent on Node 20).
FROM node:22.23-alpine AS build

WORKDIR /app

# Install exactly what package-lock.json pins so every build is reproducible;
# npm ci fails if the lockfile and package.json disagree.
COPY package.json package-lock.json ./
RUN npm ci

# Cache-bust on every CI build so identical file mtimes never serve a stale layer.
ARG CACHE_DATE=unknown

# Vite bakes VITE_* values into the bundle at build time. Passed from
# the GitHub Actions workflow (repository variable VITE_GOOGLE_CLIENT_ID).
# Empty default keeps local builds working; the login page disables the
# Google button when the value is absent.
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# CDN base URL for large static assets (videos, images). When set at
# build time (e.g. https://cdn.cansee.ai), src/utils/assetUrl.js
# prefixes all asset paths with it so nginx never ships mp4 bytes.
# Empty default keeps local dev pointing at /videos/... on the origin.
ARG VITE_ASSET_CDN=
ENV VITE_ASSET_CDN=$VITE_ASSET_CDN

# Scheduling page for every "Book a demo" button (Cal.com, Calendly, ...).
# Must be an https:// URL. Empty default falls back to a sales@ mailto.
ARG VITE_DEMO_BOOKING_URL=
ENV VITE_DEMO_BOOKING_URL=$VITE_DEMO_BOOKING_URL

# Microsoft Entra ID application client ID. Empty disables Microsoft sign-in.
ARG VITE_MICROSOFT_CLIENT_ID=
ENV VITE_MICROSOFT_CLIENT_ID=$VITE_MICROSOFT_CLIENT_ID

# Enterprise single sign-on is shown only when this is exactly "true"
# (mirrors the API's ORG_FEATURES_ENABLED, which defaults to off).
ARG VITE_ORG_FEATURES_ENABLED=
ENV VITE_ORG_FEATURES_ENABLED=$VITE_ORG_FEATURES_ENABLED

# Cookiebot domain group ID for the consent banner. Empty means no banner.
ARG VITE_COOKIEBOT_CBID=
ENV VITE_COOKIEBOT_CBID=$VITE_COOKIEBOT_CBID

# Origin of the feedback service. Empty hides the in-app feedback button.
ARG VITE_FEEDBACK_API_URL=
ENV VITE_FEEDBACK_API_URL=$VITE_FEEDBACK_API_URL

# Public origin for blog canonical URLs and the sitemap. Empty means https://cansee.ai.
ARG VITE_SITE_URL=
ENV VITE_SITE_URL=$VITE_SITE_URL

COPY . .
RUN npm run build

# ── Stage 2: Hold dist for copy-to-volume on consumer ──
FROM alpine:3.19

COPY --from=build /app/dist /build

# Consumer compose mounts a named volume at /app/dist; this CMD copies fresh
# build artifacts into that volume on each `compose run --rm frontend`.
CMD ["sh", "-c", "rm -rf /app/dist/* && cp -r /build/* /app/dist/ && echo 'Frontend build complete'"]
