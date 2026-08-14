# 🌱 Apple Vegan Cafe & Restaurant — official website

[![CI](https://github.com/kostia7alania/apple-vegan-cafe/actions/workflows/ci.yml/badge.svg)](https://github.com/kostia7alania/apple-vegan-cafe/actions/workflows/ci.yml)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-100%20%2F%20100%20%2F%20100%20%2F%20100-brightgreen)](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fapple-vegan-cafe.com%2F)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![Content: family-owned](https://img.shields.io/badge/content-family--owned-orange)](CONTENT-LICENSE.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

**Live: [apple-vegan-cafe.com](https://apple-vegan-cafe.com)** — the real website
of a real family-run 100% vegan cafe in Pattaya, Thailand (144 dishes, open
7:00–22:00 every day). Built for free as an open-source project so the family
owns their little corner of the internet.

Three languages (EN / ไทย / Русский) · **$0/month** hosting · minimal
dependency-free progressive JavaScript · quadruple-100 Lighthouse · designed
to keep working for years even if nobody maintains it.

## Why this repo is fun to read

| Constraint                | How it's solved                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The family has no laptops | Git-based CMS ([Sveltia](https://github.com/sveltia/sveltia-cms)) at `/admin` — price edits from a phone become commits |
| $0/month forever          | Astro SSG → Cloudflare Workers Static Assets (static requests are free and unlimited)                                   |
| Must survive neglect      | Content lives in git; the deployed site outlives the CMS, CI and the maintainer. `git clone` = full backup              |
| Minimal progressive JS    | CSS-first navigation plus a small dependency-free menu filter and special-hours enhancement; no client framework bundle |
| Three writing systems     | Single-file i18n (`{en,th,ru}` fields), reciprocal hreflang, Thai-script URLs, per-locale slugs                         |
| Honesty as a feature      | CI guards: article prices must match the menu, no invented facts, no self-serving review markup                         |

## Quick start

```bash
git clone https://github.com/kostia7alania/apple-vegan-cafe && cd apple-vegan-cafe
corepack enable   # pnpm comes from the packageManager field
pnpm install
pnpm dev          # http://localhost:4321
```

Node 24 LTS in CI (`.nvmrc`); Node 26 works locally. Full command list and
project tour: **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Architecture in one paragraph

All content lives in this repository (`src/content/` — JSON for dishes/settings,
Markdown for articles) and is validated by Zod schemas at build time. The family
edits content from a phone at `/admin` (Sveltia CMS → commits via GitHub API →
rebuild and deploy in ~1–3 min). The public site is plain static HTML: it stays
up even if the CMS, GitHub, or the build pipeline is down.

```
src/content/     dishes/*.json, articles/{en,th,ru}/*.md, settings, locations, faqs
src/pages/       EN at root, /th/…, /ru/… + SEO landing pages
src/lib/         seo/hreflang, JSON-LD builders, i18n helpers, UI strings
scripts/         menu import from Grab export, content validators, link audit
public/admin/    Sveltia CMS (static page + config.yml)
docs/            ADRs, runbook, BACKLOG, owner's guide in Thai
tests/           vitest units + Playwright e2e (44 tests incl. a11y and honesty guards)
```

## Contributing

Yes please — see **[CONTRIBUTING.md](CONTRIBUTING.md)** for the tour, the rules
that protect the family (this is a real business, not a demo), and where to
start. Open tasks live in [docs/BACKLOG.md](docs/BACKLOG.md).

## Supporting the cafe ❤️

The best donation doesn't go through a payment processor:

- **Eat there.** Bang Lamung, Pattaya — open 7:00–22:00 every day, or order on
  [GrabFood](https://r.grab.com/o/Fj6Zvya2).
- **Leave a review** on [HappyCow](https://www.happycow.net/reviews/apple-vegan-cafe-and-restaurant-pattaya-386893)
  or Google Maps — for a small family restaurant this is worth more than money.
- **Star the repo / contribute** — it keeps the project alive.

Monetary sponsorship rails (GitHub Sponsors etc.) are not set up yet; if that
changes, `.github/FUNDING.yml` is where they will appear.

## Content model & guides

- **Dishes**: one JSON per dish; price and photos exist once, names/slugs are
  `{en,th,ru}`. `available: false` = the owner's stop-list button.
- **Current catalogue**: 144 dishes as of the owner's 2026-08-14 GrabMerchant
  export. Three current-active items absent from the previous site were
  reconciled by exact Grab `ItemID`, not by display name.
- **Menu import**: `pnpm import:menu -- --input menu.csv [--write]` — the only
  permitted source is the **owner's own GrabMerchant Bulk Update export**.
  Scraping food.grab.com violates Grab's ToS and is deliberately not
  implemented. Quarterly re-syncs: [docs/grab-resync.md](docs/grab-resync.md).
- **Grab identity map**: `scripts/data/grab-item-map.json` maps each Grab
  `ItemID` to its dish file so renames and slug changes do not break identity.
- **SEO rules**: reciprocal hreflang in `<head>` only, self-canonicals, one
  honest page per topic per language, **never** `aggregateRating`/`review` of
  our own business, no `FAQPage` markup (retired May 2026).
- **Deployment**: `pnpm deploy` (Wrangler → Cloudflare Workers Static Assets),
  config in `infrastructure/wrangler.jsonc`. CMS OAuth secrets live only in
  Cloudflare; see `infrastructure/sveltia-auth/README.md`.
- **Analytics**: optional; Cloudflare Web Analytics beacon is currently injected
  at the edge (dashboard). Do not also set
  `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` or the beacon will double.
  `PUBLIC_GA_MEASUREMENT_ID` enables GA4 with click-through conversion events.
  `PUBLIC_GOOGLE_SITE_VERIFICATION` optionally enables Search Console's HTML-tag
  verification; when empty, no verification tag is emitted. These IDs are
  public build-time values, but the current dashboard-injected analytics setup
  remains the source of truth.

## Docs

- [docs/adr/](docs/adr/) — architecture decision records (why Astro, why git-CMS…)
- [docs/BACKLOG.md](docs/BACKLOG.md) — living task list («работай» protocol)
- [docs/runbook.md](docs/runbook.md) — "site is down", recovery, dashboard settings
- [docs/HANDOVER-th.md](docs/HANDOVER-th.md) — owner's guide (Thai, phone-first)

## Licenses

Code is [MIT](LICENSE). Photos, texts, the menu and the brand belong to the
family — see [CONTENT-LICENSE.md](CONTENT-LICENSE.md). Fork the code freely;
don't ship the family's content with it.
