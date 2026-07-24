# Contributing

Thanks for looking! This is an unusual open-source project: it's the **live
website of a real family business**. You can absolutely contribute — the rules
below exist so that a merged PR never surprises the family with wrong prices,
invented facts, or a broken phone number.

## The 10-minute tour

```
src/
  content/            ← ALL content (the "database")
    dishes/*.json     one file per dish; price_thb once, name/slug are {en,th,ru}
    articles/{en,th,ru}/*.md   blog posts, linked by translationKey
    settings.json     name, phone, social, ordering links (single source of truth)
    locations.json    address, geo, opening hours
    faqs.json         Q&A ×3 locales (rendered without FAQPage markup — retired)
    categories.json   5 menu categories, localized slugs
  pages/
    *.astro           English pages (root = EN, also x-default)
    th/…, ru/…        Thai and Russian pages incl. localized-slug landings
    [...lang]/        structural pages shared by all locales (menu, contact…)
  layouts/Base.astro  header/footer/bottom-bar, head, JSON-LD injection
  lib/                seo.ts, jsonld.ts, urls.ts, i18n.ts, ui.ts (UI strings ×3)
  styles/global.css   Tailwind 4 + design tokens + print + scroll-driven FAB
scripts/              import-menu, validate-content, check-article-prices, audit-links
public/admin/         Sveltia CMS config (Decap-compatible)
infrastructure/       wrangler.jsonc (Cloudflare Workers Static Assets)
docs/                 ADRs, BACKLOG.md (task list), runbook, Thai owner's guide
tests/                vitest units + Playwright e2e
```

Key mental model: **pages are dumb, content is data**. Prices, hours, phone,
links live in `src/content/` exactly once and flow into pages, footer, JSON-LD
and OG tags. If you're about to hardcode a fact into a page — stop, it belongs
in content.

## Dev commands

```bash
pnpm dev              # dev server at :4321
pnpm build            # redirects + astro build → ./dist
pnpm lint             # eslint + prettier (CI gate)
pnpm check            # astro check + tsc (CI gate)
pnpm test             # vitest units (CI gate)
pnpm validate:content # content rules + article-price guard (CI gate)
pnpm audit:links      # internal links + anchors over dist (CI gate)
pnpm test:e2e         # 44 Playwright tests — run pnpm build first (CI gate)
```

CI runs all of the above plus linkinator and a Lighthouse budget. A PR merges
only when everything is green.

## House rules (please read before your first PR)

1. **Facts come from the family, not from us.** Prices, hours, ingredients,
   claims like "no fish sauce" — all sourced from the owner. Never invent,
   never "improve" a fact. The article-price guard will fail CI if an article
   quotes a price that disagrees with the menu.
2. **Menu data mirrors the owner's Grab export.** Don't edit dish prices/names
   by hand unless the task says so; bulk changes go through
   `pnpm import:menu` + [docs/grab-resync.md](docs/grab-resync.md).
   **Never scrape food.grab.com** — it violates Grab's ToS.
3. **Zero client-side JavaScript on content pages.** It's enforced by an e2e
   test. Interactivity is CSS (`<details>`, scroll-driven animations,
   container queries). If you think you need JS, open an issue first.
4. **SEO guardrails**: no `aggregateRating`/`review` markup of the cafe
   (Google's self-serving-review policy), no `FAQPage` markup, no doorway
   pages, no machine-translated content without a human reviewer.
5. **Privacy**: family members are "the family" — no names, no personal
   details, nothing about their private life or beliefs. Photos of people are
   not accepted without the owner's explicit OK.
6. **Thai copy needs a Thai reviewer.** PRs may land Thai text as `draft:
true`; publishing waits for the family.
7. **Content license ≠ code license.** Code is MIT; photos/texts/menu are the
   family's (see CONTENT-LICENSE.md). Don't reuse their content elsewhere.

## What to work on

- **[docs/BACKLOG.md](docs/BACKLOG.md)** — the living task list. `READY` items
  are safe to pick up; `BLOCKED` items wait for the owner — don't take those.
- Good first contributions: tests, a11y and perf polish, docs, translations
  review (native speakers of Thai especially welcome!), CSS refinements.
- Bigger ideas (search, new languages, catering page) — open an issue first;
  the architecture plan in `docs/adr/` explains what was deliberately avoided.

## PR checklist

- [ ] `pnpm lint && pnpm check && pnpm test && pnpm validate:content` green
- [ ] `pnpm build && pnpm audit:links && pnpm test:e2e` green
- [ ] No facts invented; content edits point to their source (owner message,
      Grab export, existing content)
- [ ] Screenshots for visual changes (mobile 390px + desktop)

That's it. Small PRs merge fast — the maintainer reads everything.
