# CMS auth Worker (one-time setup)

Sveltia CMS authenticates against GitHub through a tiny OAuth proxy Worker:
https://github.com/sveltia/sveltia-cms-auth (MIT). Nothing from it lives in
this repo — this doc is the deployment record.

## Steps

1. Create a GitHub **OAuth App** (Settings → Developer settings):
   - Homepage URL: `https://apple-vegan-cafe.com`
   - Callback URL: `https://<auth-worker>.workers.dev/callback`
2. Deploy sveltia-cms-auth to the Cloudflare account (its README:
   `wrangler deploy`).
3. Set Worker secrets **in the dashboard only** (never in git):
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `ALLOWED_DOMAINS=apple-vegan-cafe.com` (restricts which sites may use it)
4. Put the Worker URL into `public/admin/config.yml` → `backend.base_url`,
   and the real `owner/repo` into `backend.repo`.
5. Give each family member a GitHub account with **write** access to the repo
   (collaborators) — that is the CMS login.

## Secret boundaries (repo-wide rule)

| Location             | What lives there                             |
| -------------------- | -------------------------------------------- |
| This public repo     | code, content, `PUBLIC_*` config only        |
| Cloudflare dashboard | OAuth secrets, Workers Builds variables, DNS |
| GitHub settings      | collaborator access, the OAuth app           |
