/**
 * Generates the static branded Open Graph image (public/og-default.png,
 * 1200×630) from an inline SVG composition rendered with sharp.
 *
 * Run once (and commit the PNG) whenever the branding changes:
 *   pnpm exec tsx scripts/generate-og.ts
 *
 * Design system ("Thai garden table"): cream field, deep-green frame,
 * the apple-leaf brand mark from the header logo (same paths, scaled up),
 * a festival ribbon (leaf → mango → เจ-red) and the three-leaf sprig divider.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 120 * 1024;

// Palette — mirrors src/styles/global.css tokens.
const cream = '#faf6ed';
const creamEdge = '#e5dcc3';
const leaf = '#2f5d3a';
const leafDark = '#1e3d26';
const mango = '#e8a13c';
const jay = '#b3382c';
const ink = '#4a4438';

const serif = "Georgia, 'Times New Roman', serif";

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${leaf}"/>
      <stop offset="0.5" stop-color="${mango}"/>
      <stop offset="1" stop-color="${jay}"/>
    </linearGradient>
  </defs>

  <!-- cream field -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${cream}"/>

  <!-- festival ribbon along the top edge -->
  <rect x="0" y="0" width="${WIDTH}" height="10" fill="url(#ribbon)"/>

  <!-- deep-green frame -->
  <rect x="34" y="40" width="${WIDTH - 68}" height="${HEIGHT - 74}" fill="none" stroke="${leaf}" stroke-width="3"/>
  <rect x="44" y="50" width="${WIDTH - 88}" height="${HEIGHT - 94}" fill="none" stroke="${creamEdge}" stroke-width="1.5"/>

  <!-- brand mark: the header logo paths (viewBox 0 0 32 32), scaled ×7 -->
  <g transform="translate(488 78) scale(7)">
    <circle cx="16" cy="19" r="9.5" fill="${leaf}"/>
    <path d="M16.5 9.5C16.5 6.5 18.5 4.5 21.8 3.8C21.8 7 19.8 9 16.5 9.5Z" fill="${mango}"/>
    <path d="M16 9.8C15.6 8 15.8 6.6 16.6 5.2" stroke="#26221b" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  </g>
  <!-- เจ-red dot accent: the apple's cheek highlight -->
  <circle cx="571" cy="197" r="9" fill="${jay}"/>

  <!-- title -->
  <text x="600" y="418" text-anchor="middle" font-family="${serif}" font-weight="bold" font-size="63" fill="${leafDark}">Apple Vegan Cafe &amp; Restaurant</text>

  <!-- hairline — three-leaf sprig — hairline (LeafDivider) -->
  <g stroke="${leaf}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <line x1="420" y1="462" x2="562" y2="462"/>
    <g transform="translate(580 448) scale(1.9)">
      <path d="M20 20 C20 14 20 10 20 5"/>
      <path d="M20 12 C15 11 11 8 10 3 C15 4 19 7 20 12 Z"/>
      <path d="M20 12 C25 11 29 8 30 3 C25 4 21 7 20 12 Z"/>
    </g>
    <line x1="638" y1="462" x2="780" y2="462"/>
  </g>

  <!-- subline with mango + เจ-red separator dots -->
  <text x="600" y="521" text-anchor="middle" font-family="${serif}" font-size="34" letter-spacing="1" fill="${ink}">100% vegan&#160;&#160;&#160;&#160;&#160;&#160;Pattaya&#160;&#160;&#160;&#160;&#160;&#160;from 7:30</text>
  <circle cx="530" cy="510" r="6" fill="${mango}"/>
  <circle cx="703" cy="510" r="6" fill="${jay}"/>
</svg>`;

const out = resolve(import.meta.dirname, '../public/og-default.png');
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
writeFileSync(out, png);

const kb = (png.length / 1024).toFixed(1);
if (png.length > MAX_BYTES) {
  console.error(`og-default.png is ${kb} KB — exceeds the ${MAX_BYTES / 1024} KB budget`);
  process.exit(1);
}
console.log(`wrote ${out} (${kb} KB)`);
