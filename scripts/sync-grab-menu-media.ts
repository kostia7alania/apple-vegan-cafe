/**
 * Reconcile responsive dish images from an owner-authenticated GrabMerchant
 * catalogue payload into the website by exact Grab ItemID.
 *
 * The script stores public Grab CDN URLs and measured dimensions only. Image
 * bytes stay out of git. Existing non-Grab images are preserved after the Grab
 * catalogue image, while an older Grab snapshot is replaced only after the
 * complete reconciliation plan has passed validation.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const dishesDir = join(root, 'src/content/dishes');
const itemMapPath = join(root, 'scripts/data/grab-item-map.json');
const ITEM_ID_RE = /^THITE\d{19}$/;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

interface GrabItem {
  itemID: string;
  itemName?: string;
  imageURL?: string;
  imageURLs?: string[];
  webPURL?: string;
  webPURLs?: string[];
  attributes?: { cluster?: string; value?: string; status?: string }[];
}

interface DownloadedManifestItem {
  sourceAssetHash?: string;
  width?: number;
  height?: number;
}

interface DishImage {
  origin?: string;
  [key: string]: unknown;
}

interface DishRecord {
  images?: DishImage[];
  grabDietaryPreference?: 'vegan' | 'vegetarian' | null;
  [key: string]: unknown;
}

interface ImageMetadata {
  width: number;
  height: number;
}

interface GrabMediaAsset {
  src: string;
  srcSmall: string | null;
  srcLarge: string | null;
  srcSmallWidth: number | null;
  srcLargeWidth: number | null;
  width: number;
  height: number;
  origin: 'grab-merchant-catalogue';
  grabItemId: string;
  capturedAt: string;
  credit: null;
}

interface PlannedWrite {
  itemId: string;
  dishFile: string;
  changedFields: string[];
  content: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function calendarDateInBangkok(date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function argumentValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function argumentValues(args: string[], name: string): string[] {
  return args.flatMap((value, index) =>
    value === name && args[index + 1] ? [args[index + 1]!] : [],
  );
}

function collectGrabItems(value: unknown, found: GrabItem[] = []): GrabItem[] {
  if (Array.isArray(value)) {
    for (const child of value) collectGrabItems(child, found);
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  const object = value as Record<string, unknown>;
  if (typeof object.itemID === 'string' && ITEM_ID_RE.test(object.itemID)) {
    found.push(object as unknown as GrabItem);
    return found;
  }
  for (const child of Object.values(object)) collectGrabItems(child, found);
  return found;
}

function safeGrabImageUrl(raw: string, itemId: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(`invalid image URL for ${itemId}`);
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'food-cms.grab.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/\.(?:webp|jpe?g|png)$/i.test(url.pathname) ||
    url.pathname.match(/THITE\d{19}/)?.[0] !== itemId
  ) {
    return fail(`unsafe or mismatched Grab image URL for ${itemId}`);
  }
  return url.toString();
}

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

function comparableGrabMedia(asset: DishImage | GrabMediaAsset) {
  const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);
  const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null);
  return {
    src: stringOrNull(asset.src),
    srcSmall: stringOrNull(asset.srcSmall),
    srcLarge: stringOrNull(asset.srcLarge),
    srcSmallWidth: numberOrNull(asset.srcSmallWidth),
    srcLargeWidth: numberOrNull(asset.srcLargeWidth),
    width: numberOrNull(asset.width),
    height: numberOrNull(asset.height),
    origin: stringOrNull(asset.origin),
    grabItemId: stringOrNull(asset.grabItemId),
  };
}

function sameGrabMedia(current: DishImage[], proposed: GrabMediaAsset[]): boolean {
  return (
    JSON.stringify(current.map(comparableGrabMedia)) ===
    JSON.stringify(proposed.map(comparableGrabMedia))
  );
}

function readManifestMetadata(paths: string[]): Map<string, ImageMetadata> {
  const metadata = new Map<string, ImageMetadata>();
  for (const path of paths) {
    const manifest = JSON.parse(readFileSync(resolve(path), 'utf8')) as {
      downloaded?: DownloadedManifestItem[];
    };
    for (const item of manifest.downloaded ?? []) {
      if (
        item.sourceAssetHash &&
        Number.isInteger(item.width) &&
        (item.width ?? 0) > 0 &&
        Number.isInteger(item.height) &&
        (item.height ?? 0) > 0
      ) {
        metadata.set(item.sourceAssetHash, { width: item.width!, height: item.height! });
      }
    }
  }
  return metadata;
}

async function fetchImageMetadata(rawUrl: string, itemId: string): Promise<ImageMetadata> {
  let current = safeGrabImageUrl(rawUrl, itemId);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) fail(`Grab image redirect for ${itemId} has no location`);
      current = safeGrabImageUrl(new URL(location, current).toString(), itemId);
      continue;
    }
    if (!response.ok) fail(`Grab image fetch failed for ${itemId}: HTTP ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) fail(`Grab image is too large for ${itemId}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      fail(`Grab image byte size is invalid for ${itemId}`);
    }
    const image = await sharp(bytes).metadata();
    if (!image.width || !image.height) fail(`Grab image dimensions are missing for ${itemId}`);
    return { width: image.width, height: image.height };
  }
  return fail(`too many Grab image redirects for ${itemId}`);
}

async function metadataFor(
  url: string,
  itemId: string,
  cached: Map<string, ImageMetadata>,
  fetchMissing: boolean,
): Promise<ImageMetadata> {
  const hash = urlHash(url);
  const existing = cached.get(hash);
  if (existing) return existing;
  if (!fetchMissing) {
    return fail(
      `missing measured dimensions for ${itemId} (${hash.slice(0, 12)}); add a recovery manifest or pass --fetch-metadata`,
    );
  }
  const measured = await fetchImageMetadata(url, itemId);
  cached.set(hash, measured);
  return measured;
}

async function buildMediaAssets(
  item: GrabItem,
  capturedAt: string,
  metadata: Map<string, ImageMetadata>,
  fetchMissing: boolean,
): Promise<GrabMediaAsset[]> {
  const lowUrls = item.imageURLs?.length ? item.imageURLs : item.imageURL ? [item.imageURL] : [];
  const detailUrls = item.webPURLs?.length ? item.webPURLs : item.webPURL ? [item.webPURL] : [];
  const imageCount = Math.max(lowUrls.length, detailUrls.length);
  const assets: GrabMediaAsset[] = [];

  for (let index = 0; index < imageCount; index += 1) {
    const urls = [lowUrls[index], detailUrls[index]]
      .filter((url): url is string => Boolean(url))
      .map((url) => safeGrabImageUrl(url, item.itemID));
    const uniqueUrls = [...new Set(urls)];
    const measuredCandidates = await Promise.all(
      uniqueUrls.map(async (url) => ({
        url,
        ...(await metadataFor(url, item.itemID, metadata, fetchMissing)),
      })),
    );
    // Grab may expose both the menu-card and detail URL at the same native
    // width for old uploads. Keep the later detail candidate; duplicate width
    // descriptors are invalid and would not give the browser another choice.
    const byWidth = new Map<number, (typeof measuredCandidates)[number]>();
    for (const candidate of measuredCandidates) byWidth.set(candidate.width, candidate);
    const candidates = [...byWidth.values()];
    candidates.sort((left, right) => left.width - right.width);
    if (candidates.length === 0) continue;
    if (candidates.length > 3) fail(`more than three responsive candidates for ${item.itemID}`);
    const [base, middle, largest] = candidates;
    if (!base) continue;
    const second = largest ?? middle;
    assets.push({
      src: base.url,
      srcSmall: largest ? (middle?.url ?? null) : null,
      srcLarge: second?.url ?? null,
      srcSmallWidth: largest ? (middle?.width ?? null) : null,
      srcLargeWidth: second?.width ?? null,
      width: base.width,
      height: base.height,
      origin: 'grab-merchant-catalogue',
      grabItemId: item.itemID,
      capturedAt,
      credit: null,
    });
  }
  return assets;
}

async function main() {
  const args = process.argv.slice(2);
  const input = argumentValue(args, '--input');
  const capturedAt = argumentValue(args, '--captured-at');
  const manifestPaths = argumentValues(args, '--manifest');
  const write = args.includes('--write');
  const fetchMissing = args.includes('--fetch-metadata');
  if (!input || !capturedAt) {
    fail(
      'usage: tsx scripts/sync-grab-menu-media.ts --input <Grab API JSON> --captured-at YYYY-MM-DD [--manifest <recovery manifest>] [--fetch-metadata] [--write]',
    );
  }
  const capturedDate = new Date(`${capturedAt}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(capturedAt) ||
    Number.isNaN(capturedDate.valueOf()) ||
    capturedDate.toISOString().slice(0, 10) !== capturedAt ||
    capturedAt > calendarDateInBangkok()
  ) {
    fail('--captured-at must be a valid non-future YYYY-MM-DD date');
  }

  const itemMap = JSON.parse(readFileSync(itemMapPath, 'utf8')) as {
    items?: Record<string, string>;
  };
  if (!itemMap.items) fail('grab-item-map.json must contain an items object');
  const targets = new Set<string>();
  for (const [itemId, dishFile] of Object.entries(itemMap.items)) {
    if (!ITEM_ID_RE.test(itemId)) fail(`invalid mapped Grab ItemID: ${itemId}`);
    if (basename(dishFile) !== dishFile || !dishFile.endsWith('.json')) {
      fail(`unsafe mapped dish filename: ${dishFile}`);
    }
    if (targets.has(dishFile)) fail(`duplicate mapped dish filename: ${dishFile}`);
    if (!existsSync(join(dishesDir, dishFile))) fail(`mapped dish file is missing: ${dishFile}`);
    targets.add(dishFile);
  }

  const payload = JSON.parse(readFileSync(resolve(input), 'utf8')) as unknown;
  const items = collectGrabItems(payload);
  const uniqueItems = new Map<string, GrabItem>();
  for (const item of items) {
    if (uniqueItems.has(item.itemID)) fail(`duplicate Grab ItemID in API payload: ${item.itemID}`);
    uniqueItems.set(item.itemID, item);
  }
  const unmapped = [...uniqueItems.keys()].filter((itemId) => !itemMap.items?.[itemId]);
  const missing = Object.keys(itemMap.items).filter((itemId) => !uniqueItems.has(itemId));
  if (unmapped.length || missing.length) {
    fail(
      `catalogue/map mismatch: ${unmapped.length} unmapped API item(s), ${missing.length} mapped item(s) missing from API`,
    );
  }

  const metadata = readManifestMetadata(manifestPaths);
  const planned: PlannedWrite[] = [];
  const dietaryPreferenceCounts = new Map<string, number>();
  let unchanged = 0;
  let imageCount = 0;
  for (const [itemId, dishFile] of Object.entries(itemMap.items)) {
    const item = uniqueItems.get(itemId)!;
    const dietaryPreferences = [
      ...new Set(
        (item.attributes ?? [])
          .filter(
            ({ cluster, status }) => cluster === 'Dietary preferences' && status === 'Enabled',
          )
          .map(({ value }) => value?.toLowerCase())
          .filter((value): value is 'vegan' | 'vegetarian' =>
            ['vegan', 'vegetarian'].includes(value ?? ''),
          ),
      ),
    ];
    if (dietaryPreferences.length !== 1) {
      fail(`expected one supported Grab dietary preference for ${itemId}`);
    }
    const grabDietaryPreference = dietaryPreferences[0]!;
    dietaryPreferenceCounts.set(
      grabDietaryPreference,
      (dietaryPreferenceCounts.get(grabDietaryPreference) ?? 0) + 1,
    );
    const grabImages = await buildMediaAssets(item, capturedAt, metadata, fetchMissing);
    if (grabImages.length === 0) fail(`no Grab catalogue image found for ${itemId}`);
    imageCount += grabImages.length;
    const dishPath = join(dishesDir, dishFile);
    const dish = JSON.parse(readFileSync(dishPath, 'utf8')) as DishRecord;
    const existingImages = dish.images ?? [];
    const existingGrabImages = existingImages.filter(
      ({ origin }) => origin === 'grab-merchant-catalogue',
    );
    const localImages = existingImages.filter(({ origin }) => origin !== 'grab-merchant-catalogue');
    const mediaChanged = !sameGrabMedia(existingGrabImages, grabImages);
    const currentDietaryPreference = dish.grabDietaryPreference ?? null;
    const dietaryChanged = currentDietaryPreference !== grabDietaryPreference;
    if (!mediaChanged && !dietaryChanged) {
      unchanged += 1;
      continue;
    }

    const changedFields = [
      ...(mediaChanged ? ['media'] : []),
      ...(dietaryChanged
        ? [`dietary ${currentDietaryPreference ?? 'unset'}→${grabDietaryPreference}`]
        : []),
    ];
    const next = {
      ...dish,
      images: mediaChanged ? [...grabImages, ...localImages] : existingImages,
      grabDietaryPreference,
    };
    planned.push({
      itemId,
      dishFile,
      changedFields,
      content: `${JSON.stringify(next, null, 2)}\n`,
    });
  }

  console.log(
    `Grab media reconciliation: ${uniqueItems.size} items, ${planned.length} changed, ${unchanged} unchanged, ${imageCount} images`,
  );
  console.log(
    `Grab dietary preferences: ${[...dietaryPreferenceCounts.entries()].map(([name, count]) => `${name}=${count}`).join(', ')}`,
  );
  console.log(
    `Metadata: ${metadata.size} measured CDN asset(s); mode=${write ? 'write' : 'dry-run'}`,
  );
  for (const plan of planned) {
    console.log(`CHANGED ${plan.itemId} → ${plan.dishFile}: ${plan.changedFields.join(' | ')}`);
  }
  if (write) {
    for (const plan of planned) writeFileSync(join(dishesDir, plan.dishFile), plan.content);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
