/**
 * Recover merchant-owned Grab catalogue images without browser credentials.
 *
 * Accepted inputs:
 * - a copied Grab catalogue JSON response;
 * - an official GrabFood Partner API menu payload;
 * - a sanitized Chrome HAR containing JSON response bodies.
 *
 * This script never replays captured requests, reads browser state, or writes to
 * public/. Discovery is the default; downloads require --write, exact allowed
 * hosts, provenance, and a new staging directory outside public/.
 *
 * Usage:
 *   pnpm grab:photos -- --input /tmp/grab-menu.json
 *   pnpm grab:photos -- --input /tmp/grab.har --write \
 *     --output /private/tmp/apple-grab-photos-2026-08-11 \
 *     --provenance ai-generated --allow-host images.example.com
 */
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

type JsonRecord = Record<string, unknown>;
type Provenance = 'unknown' | 'owner-original' | 'ai-generated' | 'licensed';

interface ItemMapFile {
  items: Record<string, string>;
}

interface PhotoCandidate {
  dishFile: string;
  grabItemId: string;
  identityUrlHash: string;
  name: string | null;
  photoUrl: string;
  redactedUrl: string;
  urlHash: string;
}

interface DownloadedPhoto {
  bytes: number;
  contentType: string;
  dishFile: string;
  file: string;
  grabItemId: string;
  height: number;
  name: string | null;
  ownerVisualConfirmation: 'pending';
  provenance: Provenance;
  publicationPermission: 'pending';
  sourceSha256: string;
  sourceHost: string;
  sourceOrigin: string;
  sourceAssetHash: string;
  sourceUrlHash: string;
  width: number;
}

const root = resolve(import.meta.dirname, '..');
const mapPath = join(root, 'scripts/data/grab-item-map.json');
const publicDir = join(root, 'public');
const maxBytes = 2 * 1024 * 1024;
const maxDimension = 4000;
const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const sensitiveKeys = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
]);

function isSensitiveHeaderName(name: string): boolean {
  const normalized = name.toLowerCase().replaceAll('_', '-');
  return (
    normalized === 'authorization' ||
    normalized === 'proxy-authorization' ||
    normalized === 'cookie' ||
    normalized === 'set-cookie' ||
    normalized.includes('api-key') ||
    normalized.includes('apikey') ||
    normalized.includes('token') ||
    normalized.includes('secret')
  );
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function getAllArgs(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const value = args[index + 1];
    if (args[index] === name && value) values.push(value);
  }
  return values;
}

function fail(message: string): never {
  throw new Error(message);
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`${label} is not valid JSON (${detail})`);
  }
}

function hasSensitiveMaterial(value: unknown, seen = new Set<object>()): string | null {
  if (value === null || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const match = hasSensitiveMaterial(entry, seen);
      if (match) return match;
    }
    return null;
  }
  for (const [key, entry] of Object.entries(value as JsonRecord)) {
    const normalized = key.toLowerCase().replaceAll('-', '').replaceAll('_', '');
    if (sensitiveKeys.has(key.toLowerCase()) || sensitiveKeys.has(normalized)) return key;
    const match = hasSensitiveMaterial(entry, seen);
    if (match) return match;
  }
  return null;
}

function isJsonMime(value: string): boolean {
  const mime = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return (
    mime === 'application/json' || mime === 'text/json' || /^application\/.+\+json$/.test(mime)
  );
}

function payloadsFromHar(har: JsonRecord): unknown[] {
  const log = asRecord(har.log);
  const entries = Array.isArray(log?.entries) ? log.entries : null;
  if (!entries) return [];
  const payloads: unknown[] = [];
  for (const entryValue of entries) {
    const entry = asRecord(entryValue);
    const request = asRecord(entry?.request);
    const response = asRecord(entry?.response);
    const content = asRecord(response?.content);
    if (!request || !response || !content) continue;
    for (const side of [request, response]) {
      const headers = Array.isArray(side.headers) ? side.headers : [];
      for (const headerValue of headers) {
        const header = asRecord(headerValue);
        const name = typeof header?.name === 'string' ? header.name.toLowerCase() : '';
        if (isSensitiveHeaderName(name)) {
          fail(`HAR contains sensitive header "${name}"; export a sanitized HAR`);
        }
      }
      if (Array.isArray(side.cookies) && side.cookies.length > 0) {
        fail('HAR contains cookies; export a sanitized HAR');
      }
    }
    if (request.postData !== undefined && request.postData !== null) {
      fail('HAR contains request postData; copy the catalogue response body instead');
    }
    if (String(request.method ?? '').toUpperCase() !== 'GET') continue;
    const status = Number(response.status);
    if (!Number.isInteger(status) || status < 200 || status >= 300) continue;
    if (!isJsonMime(String(content.mimeType ?? ''))) continue;
    if (typeof content.text !== 'string' || content.text.length === 0) continue;
    const decoded =
      content.encoding === 'base64'
        ? Buffer.from(content.text, 'base64').toString('utf8')
        : content.text;
    payloads.push(parseJson(decoded, 'HAR JSON response'));
  }
  return payloads;
}

function findMenuRoots(value: unknown, roots: JsonRecord[], seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) findMenuRoots(entry, roots, seen);
    return;
  }
  const record = value as JsonRecord;
  if (Array.isArray(record.categories)) {
    const hasItems = record.categories.some((category) => Array.isArray(asRecord(category)?.items));
    if (hasItems) roots.push(record);
  }
  for (const entry of Object.values(record)) findMenuRoots(entry, roots, seen);
}

function readGrabItemId(item: JsonRecord): string | null {
  const values = ['id', 'itemID', 'itemId', 'item_id']
    .map((key) => item[key])
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim());
  const unique = [...new Set(values)];
  if (unique.length > 1) fail('catalogue item contains conflicting ItemID fields');
  return unique[0] ?? null;
}

function readPhotoUrls(item: JsonRecord): unknown[] | null {
  if (Array.isArray(item.photos)) return item.photos;
  if (Array.isArray(item.imageURLs)) return item.imageURLs;
  if (typeof item.imageURL === 'string') return [item.imageURL];
  if (Array.isArray(item.webPURLs)) return item.webPURLs;
  if (typeof item.webPURL === 'string') return [item.webPURL];
  return null;
}

function safePhotoUrl(raw: string): {
  host: string;
  identity: string;
  redacted: string;
  url: URL;
} {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail('catalogue contains an invalid photo URL');
  }
  if (url.protocol !== 'https:') fail(`photo URL must use HTTPS (${url.protocol})`);
  if (url.username || url.password) fail('photo URL must not contain credentials');
  if (url.port) fail('photo URL must use the default HTTPS port');
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || isIP(host) !== 0) {
    fail(`photo URL uses a forbidden host (${host || 'empty'})`);
  }
  const redacted = url.origin;
  const identity = `${url.origin}${url.pathname}`;
  return { host, identity, redacted, url };
}

function validateItemMap(itemMap: Record<string, string>): void {
  const dishFiles = new Set<string>();
  for (const [grabItemId, dishFile] of Object.entries(itemMap)) {
    if (!/^THITE\d{19}$/.test(grabItemId)) {
      fail(`Grab ItemID map contains invalid ID ${grabItemId}`);
    }
    if (
      typeof dishFile !== 'string' ||
      !dishFile.endsWith('.json') ||
      basename(dishFile) !== dishFile ||
      dishFile === '.json'
    ) {
      fail(`Grab ItemID ${grabItemId} has an unsafe dish target`);
    }
    if (dishFiles.has(dishFile)) fail(`Grab ItemID map targets ${dishFile} more than once`);
    if (!existsSync(join(root, 'src/content/dishes', dishFile))) {
      fail(`Grab ItemID ${grabItemId} targets a missing dish file`);
    }
    dishFiles.add(dishFile);
  }
}

function collectCandidates(
  payloads: unknown[],
  itemMap: Record<string, string>,
): {
  candidates: PhotoCandidate[];
  foundItemIds: Set<string>;
  menuRoots: number;
  unmapped: string[];
} {
  const menuRoots: JsonRecord[] = [];
  for (const payload of payloads) findMenuRoots(payload, menuRoots);
  const byItem = new Map<string, PhotoCandidate>();
  const byAsset = new Map<string, string>();
  const foundItemIds = new Set<string>();
  const unmapped = new Set<string>();

  for (const rootRecord of menuRoots) {
    for (const categoryValue of rootRecord.categories as unknown[]) {
      const category = asRecord(categoryValue);
      if (!category || !Array.isArray(category.items)) continue;
      for (const itemValue of category.items) {
        const item = asRecord(itemValue);
        if (!item) continue;
        const grabItemId = readGrabItemId(item);
        if (!grabItemId) continue;
        foundItemIds.add(grabItemId);
        if (!Object.hasOwn(itemMap, grabItemId)) {
          unmapped.add(grabItemId);
          continue;
        }
        const photos = readPhotoUrls(item);
        if (!photos || photos.length === 0) continue;
        const photoStrings = photos.filter(
          (photo): photo is string => typeof photo === 'string' && photo.trim() !== '',
        );
        if (photoStrings.length === 0) continue;
        if (photoStrings.length !== 1 || photoStrings.length !== photos.length) {
          fail(`ItemID ${grabItemId} has an ambiguous photos array; expected exactly one URL`);
        }
        const photoUrl = photoStrings[0];
        const dishFile = itemMap[grabItemId];
        if (!photoUrl || !dishFile) fail(`ItemID ${grabItemId} has an incomplete map or photo`);
        const normalized = safePhotoUrl(photoUrl);
        const candidate: PhotoCandidate = {
          dishFile,
          grabItemId,
          identityUrlHash: sha256(normalized.identity),
          name:
            typeof item.name === 'string' && item.name.trim()
              ? item.name.trim()
              : typeof item.itemName === 'string' && item.itemName.trim()
                ? item.itemName.trim()
                : null,
          photoUrl: normalized.url.toString(),
          redactedUrl: normalized.redacted,
          urlHash: sha256(normalized.url.toString()),
        };
        const prior = byItem.get(grabItemId);
        if (prior && prior.photoUrl !== candidate.photoUrl) {
          fail(`ItemID ${grabItemId} appears with different photo URLs`);
        }
        const priorItem = byAsset.get(candidate.identityUrlHash);
        if (priorItem && priorItem !== grabItemId) {
          fail(`ItemIDs ${priorItem} and ${grabItemId} point to the same photo asset`);
        }
        byAsset.set(candidate.identityUrlHash, grabItemId);
        byItem.set(grabItemId, candidate);
      }
    }
  }

  return {
    candidates: [...byItem.values()].sort((a, b) => a.grabItemId.localeCompare(b.grabItemId)),
    foundItemIds,
    menuRoots: menuRoots.length,
    unmapped: [...unmapped].sort(),
  };
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      return isPrivateAddress(normalized.slice('::ffff:'.length));
    }
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    );
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const a = parts[0]!;
  const b = parts[1]!;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

async function assertPublicHost(host: string): Promise<void> {
  const records = await lookup(host, { all: true, verbatim: true });
  if (records.length === 0) fail(`host ${host} did not resolve`);
  for (const record of records) {
    if (isPrivateAddress(record.address)) fail(`host ${host} resolves to a private address`);
  }
}

async function fetchApprovedImage(
  startUrl: string,
  allowedHosts: Set<string>,
): Promise<{
  body: Buffer;
  contentType: string;
  finalHost: string;
}> {
  let current = new URL(startUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const host = current.hostname.toLowerCase();
    if (!allowedHosts.has(host)) fail(`host ${host} is not explicitly allowed`);
    await assertPublicHost(host);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        headers: { Accept: 'image/jpeg,image/png,image/webp' },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      fail(`photo download from ${host} failed`);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) fail(`redirect from ${host} has no Location header`);
      if (redirects === 3) fail('photo download exceeded three redirects');
      current = new URL(location, current);
      if (current.protocol !== 'https:') fail('photo redirect left HTTPS');
      continue;
    }
    if (!response.ok) fail(`photo download from ${host} returned HTTP ${response.status}`);
    const contentType =
      response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    if (!allowedContentTypes.has(contentType))
      fail(`unsupported photo Content-Type ${contentType || '(missing)'}`);
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > maxBytes) fail(`photo from ${host} exceeds 2 MiB`);
    if (!response.body) fail(`photo response from ${host} has no body`);
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let received = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = Buffer.from(next.value);
      received += chunk.length;
      if (received > maxBytes) {
        await reader.cancel();
        fail(`photo from ${host} exceeds 2 MiB`);
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks, received);
    if (body.length === 0 || body.length > maxBytes)
      fail(`photo from ${host} has invalid byte length`);
    return { body, contentType, finalHost: host };
  }
  fail('unreachable redirect state');
}

function detectMagic(body: Buffer): string | null {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)
    return 'image/jpeg';
  if (
    body.length >= 8 &&
    body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    body.length >= 12 &&
    body.toString('ascii', 0, 4) === 'RIFF' &&
    body.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  fail(`unsupported image type ${contentType}`);
}

function ensureSafeOutput(outputPath: string): string {
  const output = resolve(outputPath);
  const relativeToRoot = relative(root, output);
  if (output === root || !relativeToRoot.startsWith('..')) {
    fail('staging output must be outside the repository');
  }
  if (output === '/' || output === homedir() || output === publicDir) {
    fail('refusing a broad staging output path');
  }
  if (existsSync(output)) fail(`staging output already exists: ${output}`);
  return output;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputArg = getArg(args, '--input');
  if (!inputArg)
    fail('usage: pnpm grab:photos -- --input <response.json|capture.har> [--write ...]');
  const input = resolve(inputArg);
  const write = args.includes('--write');
  const provenanceRaw = getArg(args, '--provenance') ?? 'unknown';
  if (!['unknown', 'owner-original', 'ai-generated', 'licensed'].includes(provenanceRaw)) {
    fail('provenance must be unknown, owner-original, ai-generated, or licensed');
  }
  const provenance = provenanceRaw as Provenance;
  if (write && provenance === 'unknown') fail('--write requires explicit --provenance');

  const source = parseJson(readFileSync(input, 'utf8'), basename(input));
  const sourceRecord = asRecord(source);
  if (!sourceRecord) fail('input must contain a JSON object');
  const sensitive = hasSensitiveMaterial(sourceRecord);
  if (sensitive)
    fail(`input contains sensitive field "${sensitive}"; provide only a sanitized response`);
  const harPayloads = payloadsFromHar(sourceRecord);
  const payloads = harPayloads.length > 0 ? harPayloads : [sourceRecord];
  const map = parseJson(readFileSync(mapPath, 'utf8'), basename(mapPath)) as ItemMapFile;
  if (!map || !map.items || typeof map.items !== 'object') fail('Grab ItemID map is invalid');
  validateItemMap(map.items);

  const result = collectCandidates(payloads, map.items);
  if (result.menuRoots === 0) fail('no categories[].items[] menu payload found');
  const mappedIds = Object.keys(map.items).sort();
  const missingFromCapture = mappedIds.filter((id) => !result.foundItemIds.has(id));
  const hosts = [
    ...new Set(
      result.candidates.map((candidate) => new URL(candidate.photoUrl).hostname.toLowerCase()),
    ),
  ].sort();
  const summary = {
    mode: write ? 'write' : 'discovery',
    inputType: harPayloads.length > 0 ? 'sanitized-har' : 'json',
    menuRoots: result.menuRoots,
    mappedItems: mappedIds.length,
    capturedMappedItems: [...result.foundItemIds].filter((id) => id in map.items).length,
    photoCandidates: result.candidates.length,
    hosts,
    unmappedItemIdsCount: result.unmapped.length,
    unmappedItemIdsPreview: result.unmapped.slice(0, 20),
    missingMappedItemIdsCount: missingFromCapture.length,
    missingMappedItemIdsPreview: missingFromCapture.slice(0, 20),
    candidates: result.candidates.map((candidate) => ({
      grabItemId: candidate.grabItemId,
      dishFile: candidate.dishFile,
      name: candidate.name,
      sourceOrigin: candidate.redactedUrl,
      sourceAssetHash: candidate.identityUrlHash,
      sourceUrlHash: candidate.urlHash,
    })),
    provenance,
    publicationMode:
      provenance === 'ai-generated' ? 'illustration-only' : 'requires-separate-approval',
  };

  if (!write) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (result.candidates.length === 0) fail('no mapped photo candidates to download');
  const outputArg = getArg(args, '--output');
  if (!outputArg) fail('--write requires a new --output staging directory');
  const output = ensureSafeOutput(outputArg);
  const allowedHosts = new Set(getAllArgs(args, '--allow-host').map((host) => host.toLowerCase()));
  if (allowedHosts.size === 0) fail('--write requires at least one exact --allow-host');
  for (const allowedHost of allowedHosts) {
    if (!hosts.includes(allowedHost))
      fail(`allowed host ${allowedHost} was not discovered in the input`);
  }
  for (const discoveredHost of hosts) {
    if (!allowedHosts.has(discoveredHost))
      fail(`discovered host ${discoveredHost} is not explicitly allowed`);
  }

  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.partial-${process.pid}`;
  if (existsSync(temporary)) fail(`temporary staging path already exists: ${temporary}`);
  mkdirSync(temporary, { recursive: false });
  const downloaded: DownloadedPhoto[] = [];
  const downloadedHashes = new Map<string, string>();
  try {
    for (const candidate of result.candidates) {
      const fetched = await fetchApprovedImage(candidate.photoUrl, allowedHosts);
      const magic = detectMagic(fetched.body);
      if (!magic || magic !== fetched.contentType) {
        fail(`ItemID ${candidate.grabItemId} image bytes do not match Content-Type`);
      }
      const metadata = await sharp(fetched.body, { failOn: 'error' }).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width <= 0 || height <= 0 || width > maxDimension || height > maxDimension) {
        fail(`ItemID ${candidate.grabItemId} has invalid dimensions ${width}x${height}`);
      }
      const digest = sha256(fetched.body);
      const priorDigestItem = downloadedHashes.get(digest);
      if (priorDigestItem && priorDigestItem !== candidate.grabItemId) {
        fail(
          `ItemIDs ${priorDigestItem} and ${candidate.grabItemId} downloaded identical image bytes`,
        );
      }
      downloadedHashes.set(digest, candidate.grabItemId);
      const extension = extensionFor(fetched.contentType);
      const directory = join(temporary, candidate.grabItemId);
      mkdirSync(directory, { recursive: false });
      const file = `source-${digest.slice(0, 12)}.${extension}`;
      writeFileSync(join(directory, file), fetched.body, { flag: 'wx' });
      downloaded.push({
        bytes: fetched.body.length,
        contentType: fetched.contentType,
        dishFile: candidate.dishFile,
        file: `${candidate.grabItemId}/${file}`,
        grabItemId: candidate.grabItemId,
        height,
        name: candidate.name,
        ownerVisualConfirmation: 'pending',
        provenance,
        publicationPermission: 'pending',
        sourceSha256: digest,
        sourceHost: fetched.finalHost,
        sourceOrigin: candidate.redactedUrl,
        sourceAssetHash: candidate.identityUrlHash,
        sourceUrlHash: candidate.urlHash,
        width,
      });
    }
    const manifest = {
      ...summary,
      note:
        provenance === 'ai-generated'
          ? 'Recovered pixels are AI-generated illustrations, not documentary photos of served dishes.'
          : 'Recovery does not grant publication permission; owner review is still required.',
      downloaded,
    };
    writeFileSync(join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
    });
    renameSync(temporary, output);
    console.log(JSON.stringify({ ...summary, output, downloaded: downloaded.length }, null, 2));
  } catch (error) {
    rmSync(temporary, { force: true, recursive: true });
    throw error;
  }
}

main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`grab photo recovery: ${detail}`);
  process.exitCode = 1;
});
