# ADR-0002: Sveltia CMS (git-based), content in the repo

Date: 2026-07-15 · Status: accepted

## Context

The non-technical owner must edit prices/availability/photos/hours from a
phone. Budget: $0/month. The public site must survive CMS outages, and the
project must survive developer absence. Compared: Directus (self-host/Cloud),
Supabase, Sanity, Payload, Strapi, Tina, Decap, Nuxt Studio, D1+custom admin.

## Decision

**Sveltia CMS** (Decap-compatible, MIT, mobile-first PWA, first-class i18n) as
a static `/admin` page; GitHub backend; OAuth via the tiny `sveltia-cms-auth`
Cloudflare Worker. Content = Markdown/JSON in this repo.

Key eliminations: Supabase free tier pauses after ~7 days of inactivity;
Directus needs a patched VPS forever (non-semver monthly releases); Strapi's
mobile admin is unusable; Decap itself is mobile-hostile. Neglect-survival
ranking: git-based ≈9/10, Supabase-free ≈4/10, Directus-VPS ≈3/10.

## Consequences

- $0/month, `git clone` = full backup, site never depends on CMS uptime;
  worst-case editing fallback is the GitHub web UI.
- Publish latency 1–3 min (rebuild) — accepted trade-off.
- Sveltia is 0.x: mitigated by keeping the config Decap-compatible (swap the
  script tag to Decap CMS in minutes).
- Future private ops module (recipes/food cost/staff) will be a separate
  authenticated app (Workers + D1 + Access), NOT in this public repo.
