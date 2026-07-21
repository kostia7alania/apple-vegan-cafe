# Apple Vegan Cafe & Restaurant — official website

Static, multilingual (EN / ไทย / Русский) website for a family-run 100% vegan
cafe in Pattaya, Thailand. Built to cost **$0/month** and to keep working for
years without a maintainer.

**Stack:** Astro 7 (pure SSG, zero client JS) · Tailwind CSS 4 · TypeScript 6
(pinned — see ADR) · pnpm · Sveltia CMS (git-based, Decap-compatible) ·
Cloudflare Workers Static Assets.

## Architecture in one paragraph

All content lives in this repository (`src/content/` — JSON for dishes/settings,
Markdown for articles/pages) and is validated by Zod schemas at build time. The
family edits content from a phone at `/admin` (Sveltia CMS → commits via GitHub
API → Cloudflare Workers Builds rebuilds and deploys, ~1–3 min). The public site
is plain static HTML: it stays up even if the CMS, GitHub, or the build pipeline
is down. `git clone` = full backup.

## Development

```bash
corepack enable          # pnpm from the packageManager field
pnpm install
pnpm dev                 # local dev server
pnpm build               # generates redirects + builds ./dist
pnpm check               # astro check + tsc
pnpm lint / pnpm test    # eslint+prettier / vitest
pnpm test:e2e            # playwright smoke (build first)
pnpm validate:content    # cross-entity content rules (CI runs this)
```

Node: 24 LTS in CI/production (`.nvmrc`), Node 26 works locally.

## Content model

- `src/content/dishes/*.json` — one file per dish. Price and photos exist
  **once**; names/descriptions/slugs are `{en,th,ru}` objects. `available:
false` removes a dish from the menu (the owner's stop-list button).
- `src/content/articles/{en,th,ru}/*.md` — blog posts, linked across languages
  by `translationKey`, with per-language slugs.
- `src/content/settings.json`, `locations.json` — NAP, hours, links: the single
  source of truth reused by pages, footer and JSON-LD.
- The live menu was imported from the owner's Grab Bulk Update export. Dish
  files keep `reviewedAt: null` until the family checks them by hand, but the
  site is indexable because the published prices and dishes already match the
  official export.

## Menu import (from Grab)

`pnpm import:menu -- --input menu.csv [--write]`

The only permitted source is the **owner's own export** from the GrabMerchant
Portal (Menu → Bulk Update → download) or a hand-filled sheet. Scraping
food.grab.com violates Grab's ToS and is deliberately not implemented. Every
imported dish gets `reviewedAt: null` — the owner must verify each one.

The live menu (141 dishes, July 2026) was imported from such an export.
**Quarterly re-syncs**: `scripts/data/grab-item-map.json` maps every Grab
`ItemID` to its dish file (survives renames and slug changes) — see
[docs/grab-resync.md](docs/grab-resync.md) for the runbook.

## SEO rules baked in

- `/` = English (x-default), `/th/…`, `/ru/…`; reciprocal hreflang in `<head>`
  only; self-canonicals; no Accept-Language redirects.
- Restaurant + Breadcrumb + Article JSON-LD. **Never** `aggregateRating`/
  `review` of our own business (Google self-serving-review policy) and no
  `FAQPage` markup (rich results retired May 2026).
- One honest page per topic per language — no doorway pages, no machine
  translation published without human review.

## Deployment

Cloudflare Workers Static Assets, config in `infrastructure/wrangler.jsonc`:
`pnpm deploy`, or connect the repo to Workers Builds (build command
`pnpm build`, deploy command `pnpm deploy`). Secrets (CMS OAuth) live only in
the Cloudflare dashboard — this repo contains none. See
`infrastructure/sveltia-auth/README.md` for the one-time CMS auth setup.

## Analytics

Analytics is optional and build-time configured:

- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` — recommended default for the cafe:
  lightweight, cookieless pageview analytics in Cloudflare.
- `PUBLIC_GA_MEASUREMENT_ID` — optional GA4 measurement ID (`G-...`) if Google
  Ads/campaign attribution is needed.

When GA4 is enabled, the site also records simple conversion-style events for
phone, GrabFood, review, maps and outbound clicks. Phone numbers are not sent as
event values.

For GitHub deploys, set these as repository **Variables** (not secrets) because
they are public IDs used at build time.

## Docs

- [docs/adr/](docs/adr/) — architecture decision records
- [docs/runbook.md](docs/runbook.md) — "site is down", recovery, dashboard settings
- [docs/HANDOVER-th.md](docs/HANDOVER-th.md) — owner's guide (Thai)
- [CONTENT-LICENSE.md](CONTENT-LICENSE.md) — code is MIT; content is the family's
