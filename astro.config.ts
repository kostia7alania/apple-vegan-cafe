import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { TH_JAY_LANDING_PATH, TH_JAY_LANDING_REVIEWED } from './src/lib/site';

const sitemapDraftPaths = new Set(TH_JAY_LANDING_REVIEWED ? [] : [TH_JAY_LANDING_PATH]);

// Pure SSG. No adapter: deployed as static assets to Cloudflare Workers Static Assets.
// hreflang lives in <head> only (see src/components/Seo.astro), so the sitemap
// integration is used without its i18n option — one method, per Google guidance.
export default defineConfig({
  site: 'https://apple-vegan-cafe.com',
  output: 'static',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'th', 'ru'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
      fallbackType: 'redirect',
    },
    // No `fallback` map on purpose: untranslated pages simply do not exist in
    // that locale — no auto-generated duplicates, no soft-redirect pages.
  },
  integrations: [
    sitemap({
      filter: (page) => !sitemapDraftPaths.has(decodeURI(new URL(page).pathname)),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
