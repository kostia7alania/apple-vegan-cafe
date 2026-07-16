# CMS auth Worker

Sveltia CMS authenticates against GitHub through the OAuth proxy Worker
https://github.com/sveltia/sveltia-cms-auth (MIT, ~300 lines, reviewed before
deploy). **Deployed 2026-07-16** to the Cloudflare account as
`sveltia-cms-auth` at **https://auth.apple-vegan-cafe.com** with these
additions to its stock `wrangler.toml`:

```toml
routes = [
  { pattern = "auth.apple-vegan-cafe.com", custom_domain = true }
]

[vars]
ALLOWED_DOMAINS = "apple-vegan-cafe.com"
```

`public/admin/config.yml` → `backend.base_url` already points at it.

## Remaining one-time setup (owner of the GitHub account — 5 minutes)

The Worker is deployed but idle until its two OAuth secrets exist:

1. Create a GitHub **OAuth App**: github.com → Settings → Developer settings →
   OAuth Apps → New OAuth App:
   - Application name: `Apple Vegan Cafe CMS`
   - Homepage URL: `https://apple-vegan-cafe.com`
   - Authorization callback URL: `https://auth.apple-vegan-cafe.com/callback`
     Then "Generate a new client secret".
2. Set both values as Worker secrets — run these yourself and paste the values
   when prompted (do NOT hand the secret to anyone, including AI assistants):
   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID --name sveltia-cms-auth
   npx wrangler secret put GITHUB_CLIENT_SECRET --name sveltia-cms-auth
   ```
3. Open https://apple-vegan-cafe.com/admin — "Sign in with GitHub" should
   round-trip. Each family member logs in with a GitHub account that has
   **write** access to the repo (add them as collaborators).

## Secret boundaries (repo-wide rule)

| Location             | What lives there                             |
| -------------------- | -------------------------------------------- |
| This public repo     | code, content, `PUBLIC_*` config only        |
| Cloudflare dashboard | OAuth secrets, Workers Builds variables, DNS |
| GitHub settings      | collaborator access, the OAuth app           |
