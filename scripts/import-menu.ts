/**
 * Exact-identity menu reconciliation (GrabMerchant export → website).
 *
 * Accepted inputs:
 * - the owner's raw GrabMerchant Bulk Update CSV (`*ItemID,*ItemName,...`);
 * - a sanitized CSV with
 *   `grab_item_id,name_en,name_th,price_thb,category,availability`.
 *
 * The stable identity is always Grab ItemID. The importer never matches by a
 * display name, never downloads Photo columns and never overwrites editorial
 * names, slugs, descriptions, media, featured flags or verified food facts.
 * It reconciles only price, site category and permanent catalogue availability.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dishesDir = join(root, 'src/content/dishes');
const categoriesFile = join(root, 'src/content/categories.json');
const itemMapFile = join(root, 'scripts/data/grab-item-map.json');
const ITEM_ID_RE = /^THITE\d{19}$/;

type Availability = 'AVAILABLE' | 'UNAVAILABLE_PERMANENTLY' | 'UNAVAILABLE_TODAY';

interface ImportRow {
  line: number;
  itemId: string;
  sourceName: string;
  price: number;
  category: string;
  availability: Availability;
}

interface DishRecord {
  category: string;
  price_thb: number;
  available: boolean;
  [key: string]: unknown;
}

interface PlannedWrite {
  itemId: string;
  file: string;
  changedFields: string[];
  content: string;
}

function replaceTopLevelScalar(
  content: string,
  key: 'category' | 'price_thb' | 'available',
  value: string | number | boolean,
  file: string,
): string {
  const escapedKey = JSON.stringify(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = new RegExp(`^(  ${escapedKey}: )([^,\\r\\n]*)(,?)$`, 'gm');
  let replacements = 0;
  const updated = content.replace(
    line,
    (_match, prefix: string, _previous: string, comma: string) => {
      replacements += 1;
      return `${prefix}${JSON.stringify(value)}${comma}`;
    },
  );
  if (replacements !== 1) {
    throw new Error(`${file}: expected exactly one top-level ${key} scalar, found ${replacements}`);
  }
  return updated;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  if (inQuotes) throw new Error('CSV has an unmatched quote');
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function parseAvailability(value: string, line: number): Availability {
  const normalized = value.trim().toUpperCase().replaceAll('-', '_');
  const aliases: Record<string, Availability> = {
    TRUE: 'AVAILABLE',
    YES: 'AVAILABLE',
    '1': 'AVAILABLE',
    FALSE: 'UNAVAILABLE_PERMANENTLY',
    NO: 'UNAVAILABLE_PERMANENTLY',
    '0': 'UNAVAILABLE_PERMANENTLY',
    OUT: 'UNAVAILABLE_PERMANENTLY',
  };
  const status = aliases[normalized] ?? normalized;
  if (!['AVAILABLE', 'UNAVAILABLE_PERMANENTLY', 'UNAVAILABLE_TODAY'].includes(status)) {
    throw new Error(`line ${line}: unsupported availability "${value}"`);
  }
  return status as Availability;
}

const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
const write = args.includes('--write');
if (!inputPath) {
  console.error('usage: pnpm import:menu -- --input <grab-export.csv> [--write]');
  process.exit(1);
}

const categoryIds = new Set(
  (JSON.parse(readFileSync(categoriesFile, 'utf8')) as { id: string }[]).map(({ id }) => id),
);
const grabCategoryToSite: Record<string, string> = {
  เครื่องดื่ม: 'drinks',
  อาหารจานเดียว: 'one-plate',
  ของทานเล่น: 'snacks',
  กับข้าว: 'mains-share',
  ฟาดฟู้ดส์: 'pizza-fastfood',
  ฟาสต์ฟู้ด: 'pizza-fastfood',
};

const itemMap = JSON.parse(readFileSync(itemMapFile, 'utf8')) as {
  items?: Record<string, string>;
};
if (!itemMap.items || typeof itemMap.items !== 'object') {
  throw new Error('grab-item-map.json must contain an items object');
}
const mappedItems = itemMap.items;

const mappedTargets = new Set<string>();
for (const [itemId, file] of Object.entries(mappedItems)) {
  if (!ITEM_ID_RE.test(itemId)) throw new Error(`invalid mapped Grab ItemID: ${itemId}`);
  if (basename(file) !== file || !file.endsWith('.json')) {
    throw new Error(`unsafe mapped dish filename for ${itemId}: ${file}`);
  }
  if (mappedTargets.has(file)) throw new Error(`duplicate dish target in ItemID map: ${file}`);
  if (!existsSync(join(dishesDir, file))) throw new Error(`mapped dish file is missing: ${file}`);
  mappedTargets.add(file);
}

const rows = parseCsv(readFileSync(resolve(inputPath), 'utf8'));
const rawHeader = rows.shift();
if (!rawHeader) throw new Error('empty CSV');
const header = rawHeader.map((value, index) =>
  (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim(),
);
if (new Set(header).size !== header.length) throw new Error('CSV contains duplicate headers');
for (const [index, row] of rows.entries()) {
  if (row.length !== header.length) {
    throw new Error(
      `logical row ${index + 2}: expected ${header.length} columns, received ${row.length}`,
    );
  }
}

const column = (name: string) => header.indexOf(name);
const rawGrabExport = column('*ItemID') >= 0;
const requiredHeaders = rawGrabExport
  ? ['*ItemID', '*ItemName', '*Price', '*CategoryName', '*AvailableStatus']
  : ['grab_item_id', 'name_en', 'name_th', 'price_thb', 'category', 'availability'];
for (const name of requiredHeaders) {
  if (column(name) < 0) throw new Error(`missing required CSV column: ${name}`);
}

const dataRows = rawGrabExport
  ? rows.filter(
      (row) => !row[column('*ItemID')]?.startsWith('[Please refrain from deleting or editing'),
    )
  : rows;
const imported: ImportRow[] = [];
const errors: string[] = [];
const seenItemIds = new Set<string>();

for (const [index, row] of dataRows.entries()) {
  const line = index + (rawGrabExport ? 3 : 2);
  const itemId = row[column(rawGrabExport ? '*ItemID' : 'grab_item_id')]?.trim() ?? '';
  const sourceName = row[column(rawGrabExport ? '*ItemName' : 'name_en')]?.trim() ?? '';
  const priceRaw = row[column(rawGrabExport ? '*Price' : 'price_thb')]?.trim() ?? '';
  const sourceCategory = row[column(rawGrabExport ? '*CategoryName' : 'category')]?.trim() ?? '';
  const availabilityRaw =
    row[column(rawGrabExport ? '*AvailableStatus' : 'availability')]?.trim() ?? '';

  if (!ITEM_ID_RE.test(itemId)) {
    errors.push(`line ${line}: invalid Grab ItemID "${itemId}"`);
    continue;
  }
  if (seenItemIds.has(itemId)) {
    errors.push(`line ${line}: duplicate Grab ItemID ${itemId}`);
    continue;
  }
  seenItemIds.add(itemId);
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price <= 0) {
    errors.push(`line ${line}: invalid price "${priceRaw}" for ${itemId}`);
    continue;
  }
  const category = rawGrabExport ? grabCategoryToSite[sourceCategory] : sourceCategory;
  if (!category || !categoryIds.has(category)) {
    errors.push(`line ${line}: unsupported category "${sourceCategory}" for ${itemId}`);
    continue;
  }
  try {
    imported.push({
      line,
      itemId,
      sourceName,
      price,
      category,
      availability: parseAvailability(availabilityRaw, line),
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

const plannedWrites: PlannedWrite[] = [];
let unchanged = 0;
let temporaryUnavailable = 0;
for (const row of imported) {
  const file = mappedItems[row.itemId];
  if (!file) {
    errors.push(
      `line ${row.line}: unmapped Grab ItemID ${row.itemId} (${row.sourceName || 'unnamed item'}); add an exact file mapping before importing`,
    );
    continue;
  }
  const dishSource = readFileSync(join(dishesDir, file), 'utf8');
  const dish = JSON.parse(dishSource) as DishRecord;
  const nextAvailability =
    row.availability === 'UNAVAILABLE_TODAY' ? dish.available : row.availability === 'AVAILABLE';
  if (row.availability === 'UNAVAILABLE_TODAY') temporaryUnavailable += 1;

  const changedFields: string[] = [];
  if (dish.price_thb !== row.price) changedFields.push(`price ฿${dish.price_thb}→฿${row.price}`);
  if (dish.category !== row.category) {
    changedFields.push(`category ${dish.category}→${row.category}`);
  }
  if (dish.available !== nextAvailability) {
    changedFields.push(`available ${dish.available}→${nextAvailability}`);
  }
  if (changedFields.length === 0) {
    unchanged += 1;
    continue;
  }

  let content = dishSource;
  if (dish.category !== row.category) {
    content = replaceTopLevelScalar(content, 'category', row.category, file);
  }
  if (dish.price_thb !== row.price) {
    content = replaceTopLevelScalar(content, 'price_thb', row.price, file);
  }
  if (dish.available !== nextAvailability) {
    content = replaceTopLevelScalar(content, 'available', nextAvailability, file);
  }
  plannedWrites.push({
    itemId: row.itemId,
    file,
    changedFields,
    content,
  });
}

const missingMapped = Object.keys(mappedItems).filter((itemId) => !seenItemIds.has(itemId));
if (missingMapped.length > 0) {
  const preview = missingMapped
    .slice(0, 10)
    .map((itemId) => `${itemId} → ${mappedItems[itemId]}`)
    .join(', ');
  const remainder = missingMapped.length > 10 ? `, plus ${missingMapped.length - 10} more` : '';
  errors.push(
    `${missingMapped.length} mapped Grab ItemID(s) are missing from this export; a complete Bulk Update export is required: ${preview}${remainder}`,
  );
}
if (errors.length > 0) {
  console.error(`import rejected — ${errors.length} problem(s), no files written:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

for (const plan of plannedWrites) {
  console.log(`CHANGED ${plan.itemId} → ${plan.file}: ${plan.changedFields.join(', ')}`);
}

if (write) {
  // All rows, mappings and intended outputs were validated above. Only now may
  // writes begin; each write preserves every field outside the three-source fields.
  for (const plan of plannedWrites) writeFileSync(join(dishesDir, plan.file), plan.content);
}

console.log(
  `\nimport ${write ? 'APPLIED' : 'dry run'}: ${imported.length} source rows, ${plannedWrites.length} changed, ${unchanged} unchanged, ${temporaryUnavailable} temporary sold-out no-op, ${missingMapped.length} mapped IDs missing from this export`,
);
if (!write && plannedWrites.length > 0) console.log('re-run with --write to apply this exact plan');
