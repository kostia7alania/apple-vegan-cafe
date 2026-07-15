# Runbook

## The site is down

1. Check https://applevegancafe.com and the UptimeRobot alert (keyword monitor
   watches the menu page). The site is static on Cloudflare — real downtime is
   almost always DNS/domain, not "the server".
2. Check domain expiry in the Cloudflare dashboard (auto-renew must be ON).
3. Cloudflare status: https://www.cloudflarestatus.com
4. A broken deploy cannot take the site down — the last good version keeps
   serving. Check Workers Builds logs only if _changes_ stop appearing.

## Owner can't edit via /admin

- Fallback that always works: edit files directly on github.com (web UI) —
  `src/content/dishes/*.json` for prices/availability.
- If Sveltia itself is broken: swap the pinned script in
  `public/admin/index.html` to Decap CMS (same config.yml works).
- OAuth errors: re-check the sveltia-cms-auth Worker and its two secrets
  (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) in the Cloudflare dashboard.

## Changes don't appear on the site

1. Wait 3 minutes (build + cache).
2. Workers Builds → latest build log. A red build = usually content that
   failed schema validation; the error names the file and field.
3. Fix the file (or revert the commit in GitHub UI) — the next build heals.

## Backups

- Content + code + history: this git repository (GitHub + every local clone).
  Quarterly: `git clone` onto the family laptop.
- NOT in git (document changes here): Cloudflare dashboard settings — DNS
  records, domain auto-renew, Workers Builds config, the sveltia-auth Worker
  secrets, Email Routing rules. GitHub settings: collaborators, the OAuth app.

## Dependency updates

Renovate opens grouped PRs; minor/patch automerge when CI is green. Major
updates wait for a human. TypeScript is intentionally capped at 6.x
(renovate.json comment explains why; revisit at TS 7.1).

## Contacts

- Developer: TODO
- Cloudflare account owner: TODO
- GitHub org/repo admin: TODO
