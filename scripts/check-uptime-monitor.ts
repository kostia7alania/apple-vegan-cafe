/**
 * Verifies that the static build satisfies the external uptime-monitor handoff.
 * This command is deliberately local and read-only: it never calls a live URL
 * and never creates or updates a monitor.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const specPath = join(root, 'infrastructure', 'uptime-monitor.json');
const distDir = join(root, 'dist');
const requiredChecks = new Map([
  ['home', 'https://apple-vegan-cafe.com/'],
  ['menu', 'https://apple-vegan-cafe.com/menu/'],
]);
const errors: string[] = [];

interface MonitorSpec {
  version: number;
  state: 'not-configured' | 'configured';
  targetProvider: string;
  alertContact: string | null;
  cadenceSeconds: number;
  timeoutSeconds: number;
  expectedKeyword: string;
  checks: Array<{
    id: string;
    url: string;
    expectedStatus: number;
  }>;
}

function fail(message: string) {
  errors.push(message);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readSpec(): MonitorSpec | null {
  if (!existsSync(specPath)) {
    fail('monitor spec is missing: infrastructure/uptime-monitor.json');
    return null;
  }

  try {
    return JSON.parse(readFileSync(specPath, 'utf8')) as MonitorSpec;
  } catch {
    fail('monitor spec must be valid JSON');
    return null;
  }
}

function distFileFor(url: URL): string {
  if (url.pathname === '/') return join(distDir, 'index.html');
  return join(distDir, url.pathname.replace(/^\//, ''), 'index.html');
}

const spec = readSpec();

if (spec) {
  if (spec.version !== 1) fail('version must be 1');
  if (spec.state !== 'not-configured' && spec.state !== 'configured') {
    fail('state must be not-configured or configured');
  }
  if (!hasText(spec.targetProvider)) fail('targetProvider must be non-empty');
  if (spec.alertContact !== null && !hasText(spec.alertContact)) {
    fail('alertContact must be null or a non-empty contact reference');
  }
  if (spec.state === 'configured' && spec.alertContact === null) {
    fail('state cannot be configured while alertContact is null');
  }
  if (!Number.isInteger(spec.cadenceSeconds) || spec.cadenceSeconds < 60) {
    fail('cadenceSeconds must be an integer of at least 60');
  }
  if (
    !Number.isInteger(spec.timeoutSeconds) ||
    spec.timeoutSeconds < 1 ||
    spec.timeoutSeconds >= spec.cadenceSeconds
  ) {
    fail('timeoutSeconds must be a positive integer shorter than cadenceSeconds');
  }
  if (!hasText(spec.expectedKeyword) || !/^[\x20-\x7e]+$/.test(spec.expectedKeyword)) {
    fail('expectedKeyword must be non-empty locale-independent ASCII text');
  }
  if (!Array.isArray(spec.checks)) {
    fail('checks must be an array');
  } else {
    const seenIds = new Set<string>();
    for (const check of spec.checks) {
      if (seenIds.has(check.id)) fail(`duplicate check id: ${check.id}`);
      seenIds.add(check.id);

      const requiredUrl = requiredChecks.get(check.id);
      if (!requiredUrl) {
        fail(`unsupported check id: ${check.id}`);
        continue;
      }
      if (check.url !== requiredUrl) {
        fail(`${check.id}: URL must be exactly ${requiredUrl}`);
      }
      if (check.expectedStatus !== 200) {
        fail(`${check.id}: expectedStatus must be 200`);
      }

      let url: URL;
      try {
        url = new URL(check.url);
      } catch {
        fail(`${check.id}: URL must be absolute`);
        continue;
      }

      const file = distFileFor(url);
      if (!existsSync(file)) {
        fail(`${check.id}: dist file is missing; run pnpm build`);
        continue;
      }
      const html = readFileSync(file, 'utf8');
      if (!html.includes(spec.expectedKeyword)) {
        fail(`${check.id}: dist response does not contain keyword "${spec.expectedKeyword}"`);
      }
    }

    for (const id of requiredChecks.keys()) {
      if (!seenIds.has(id)) fail(`required check is missing: ${id}`);
    }
  }
}

if (errors.length > 0) {
  for (const message of [...new Set(errors)].sort()) console.error(`error: ${message}`);
  process.exit(1);
}

const state = spec!.alertContact === null ? 'NOT CONFIGURED — alertContact is null' : spec!.state;
console.log(
  `uptime handoff check passed: ${spec!.checks.length} dist routes match; external monitor: ${state}`,
);
