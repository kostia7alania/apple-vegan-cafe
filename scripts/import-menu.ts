/**
 * Menu import pipeline (Grab Merchant Portal → website).
 *
 * LEGAL: the ONLY permitted data source is the owner's own export from the
 * GrabMerchant Portal ("Menu → Bulk Update → download catalogue") or a sheet
 * the owner filled in by hand. NEVER fetch anything from food.grab.com —
 * automated scraping violates Grab's Terms of Service (Cl. 3.1.11/3.1.12).
 *
 * Usage:
 *   pnpm import:menu -- --input menu.csv           # dry run: prints the diff
 *   pnpm import:menu -- --input menu.csv --write   # writes dish JSON files
 *
 * Expected CSV columns (header row required):
 *   name_en,name_th,price_thb,category,description,photo_file,availability
 * XLSX exports: save/convert as CSV first.
 *
 * Every imported dish is written with source="grab_export" and reviewedAt=null.
 * A human (the owner) must verify each dish and set reviewedAt before launch.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dishesDir = join(root, 'src/content/dishes');
const categoriesFile = join(root, 'src/content/categories.json');

// --- minimal RFC 4180 CSV parser (quotes, escaped quotes, newlines in cells) ---
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function slugifyLatin(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Thai slugs keep Thai script (Google-endorsed); just normalize whitespace. */
function slugifyThai(value: string): string {
  return value.trim().replace(/\s+/g, '-');
}

// --- args ---------------------------------------------------------------------
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
const write = args.includes('--write');
if (!inputPath) {
  console.error('usage: pnpm import:menu -- --input <file.csv> [--write]');
  process.exit(1);
}

const categories = JSON.parse(readFileSync(categoriesFile, 'utf8')) as { id: string }[];
const categoryIds = new Set(categories.map((c) => c.id));

const rows = parseCsv(readFileSync(resolve(inputPath), 'utf8'));
const header = rows.shift();
if (!header) {
  console.error('empty CSV');
  process.exit(1);
}
const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
const idx = {
  name_en: col('name_en'),
  name_th: col('name_th'),
  price_thb: col('price_thb'),
  category: col('category'),
  description: col('description'),
  photo_file: col('photo_file'),
  availability: col('availability'),
};
for (const [name, i] of Object.entries(idx)) {
  if (
    i < 0 &&
    (name === 'name_en' || name === 'name_th' || name === 'price_thb' || name === 'category')
  ) {
    console.error(`missing required CSV column: ${name}`);
    process.exit(1);
  }
}

// existing dishes, keyed by normalized English name, for diffing
interface ExistingDish {
  file: string;
  price_thb: number;
  available: boolean;
}
const existing = new Map<string, ExistingDish>();
if (existsSync(dishesDir)) {
  for (const file of readdirSync(dishesDir).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(dishesDir, file), 'utf8'));
    existing.set(
      String(data.name?.en ?? '')
        .trim()
        .toLowerCase(),
      {
        file,
        price_thb: data.price_thb,
        available: data.available,
      },
    );
  }
}

const errors: string[] = [];
const report = { new: 0, changed: 0, unchanged: 0 };
const seenNames = new Set<string>();

rows.forEach((row, rowIndex) => {
  const line = rowIndex + 2; // 1-based + header
  const nameEn = (row[idx.name_en] ?? '').trim();
  const nameTh = (row[idx.name_th] ?? '').trim();
  const priceRaw = (row[idx.price_thb] ?? '').trim();
  const category = (row[idx.category] ?? '').trim();
  const description = idx.description >= 0 ? (row[idx.description] ?? '').trim() : '';
  const photo = idx.photo_file >= 0 ? (row[idx.photo_file] ?? '').trim() : '';
  const availability = idx.availability >= 0 ? (row[idx.availability] ?? '').trim() : 'true';

  if (!nameEn) return errors.push(`line ${line}: empty name_en`);
  if (!nameTh) errors.push(`line ${line}: empty name_th`);
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price <= 0) {
    return errors.push(`line ${line}: invalid price "${priceRaw}"`);
  }
  if (!categoryIds.has(category)) {
    return errors.push(
      `line ${line}: unknown category "${category}" (add it to src/content/categories.json first)`,
    );
  }
  const nameKey = nameEn.toLowerCase();
  if (seenNames.has(nameKey)) return errors.push(`line ${line}: duplicate dish "${nameEn}"`);
  seenNames.add(nameKey);
  if (photo && !existsSync(resolve(root, 'public/uploads', photo))) {
    errors.push(`line ${line}: photo file not found in public/uploads/: "${photo}"`);
  }

  const available = !/^(false|0|no|out)$/i.test(availability);
  const prior = existing.get(nameKey);
  if (prior && prior.price_thb === price && prior.available === available) {
    report.unchanged++;
    return;
  }
  report[prior ? 'changed' : 'new']++;
  console.log(
    prior
      ? `CHANGED ${nameEn}: ฿${prior.price_thb}→฿${price}, available ${prior.available}→${available}`
      : `NEW     ${nameEn} — ฿${price} (${category})`,
  );

  if (!write) return;
  const fileName = prior?.file ?? `${slugifyLatin(nameEn)}.json`;
  const dish = {
    category,
    price_thb: price,
    name: { en: nameEn, th: nameTh, ru: nameEn }, // RU translation: human task, seeded with EN
    description: description ? { en: description } : undefined,
    slug: {
      en: slugifyLatin(nameEn),
      th: slugifyThai(nameTh || nameEn),
      ru: slugifyLatin(nameEn),
    },
    previousSlugs: [],
    images: photo ? [`/uploads/${photo}`] : [],
    dietaryTags: ['vegan'],
    allergens: [],
    spicyLevel: 0,
    available,
    featured: false,
    source: 'grab_export',
    reviewedAt: null, // REQUIRED: the owner reviews every dish, then sets this
  };
  mkdirSync(dishesDir, { recursive: true });
  writeFileSync(join(dishesDir, fileName), `${JSON.stringify(dish, null, 2)}\n`);
});

console.log(
  `\nimport ${write ? 'APPLIED' : 'dry run'}: ${report.new} new, ${report.changed} changed, ${report.unchanged} unchanged`,
);
if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
if (!write) console.log('re-run with --write to apply');
