# ADR-0001: Astro 7 pure SSG, no islands at launch

Date: 2026-07-15 · Status: accepted

## Context

Content-driven cafe site; hard requirements: maximum SEO/performance on mobile
4G, minimal client JS, $0/month, must survive 12+ months without maintenance.
Candidates compared: Astro SSG, Astro+Svelte islands, SvelteKit SSG, Nuxt SSG,
Next static.

## Decision

Astro 7.0.x, `output: 'static'`, **no framework islands**. Menu filtering uses
`<details>`; the language switcher is plain links. TypeScript pinned to 6.x
(Astro/Volar tooling does not support TS 7.0's missing programmatic API —
Microsoft's own guidance; revisit at TS 7.1). Node 24 LTS in CI (Node 26 is
Current-only until ~Oct 2026).

## Consequences

- Zero-JS pages by default; SvelteKit hydrates unless opted out per page, Nuxt
  always ships the Vue runtime — both rejected for this content site.
- Built-in i18n routing, content collections (Zod), build-time image pipeline.
- If real interactivity appears later (search), add Pagefind or one Svelte
  island — additive, no rewrite.
