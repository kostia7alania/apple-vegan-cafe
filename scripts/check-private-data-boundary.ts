/** Prevent confidential business data from entering the public repository or build. */
import { execFileSync } from 'node:child_process';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';

const projectRoot = resolve('.');
const publicRoots = [join(projectRoot, 'public'), join(projectRoot, 'src')];
const checkDist = process.argv.slice(2).some((argument) => argument === '--dist');
const failures: string[] = [];
const forbiddenPublicExtensions = new Set(['.csv', '.tsv', '.xls', '.xlsx', '.pdf', '.zip']);
const searchableExtensions = new Set([
  '.astro',
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.md',
  '.ts',
  '.tsv',
  '.txt',
  '.xml',
  '.yml',
  '.yaml',
]);
const forbiddenTrackedBasenames = new Set([
  'AGENT-BRIEF.md',
  'FORWARD-LOOKING-ANALYSIS.md',
  'GMFR-COVERAGE.md',
  'GMFR-EXTRACTION.md',
  'INVOICE-COVERAGE.md',
  'INVOICE-EXTRACTION.md',
  'business-context.json',
  'menu-items-current.json',
  'rating-overview-current.json',
  'sales-forecast-metadata.json',
  'summary.json',
]);
const privateArtifactMarkers = [
  '"classification": "confidential-business-data"',
  'Confidential context, not public website copy.',
  '# GMFR XLSX extraction',
  '# Grab invoice extraction',
  '# Куда идёт Grab-канал — срез ',
  'PRIVATE · LOCAL SNAPSHOT',
];
const sensitiveMarkers = [
  'PRIVATE-ARCHIVAL-HANDOVER',
  'reviews-written-alltime.csv',
  'finance-transactions-detailed-available.csv',
  'gmfr-payment-rows-available.csv',
  'gmfr-payout-rows-available.csv',
  'Customer name,Status,Ordered items',
  'Long order ID',
  'Bank statement ID',
  'business-data/private',
  'grab-backup.local',
];

async function walk(path: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: projectRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

for (const trackedPath of trackedFiles) {
  const segments = trackedPath.split('/');
  const extension = extname(trackedPath).toLowerCase();
  if (
    trackedPath === 'business-data/private' ||
    trackedPath.startsWith('business-data/private/') ||
    segments.some((segment) => segment.endsWith('.local'))
  ) {
    failures.push(`${trackedPath} is inside a private backup path but is tracked by Git`);
  }
  if (forbiddenPublicExtensions.has(extension)) {
    failures.push(`${trackedPath} is a private-export file type tracked by Git`);
  }
  if (
    forbiddenTrackedBasenames.has(basename(trackedPath)) ||
    trackedPath === 'dashboard/index.html' ||
    trackedPath.endsWith('/dashboard/index.html')
  ) {
    failures.push(`${trackedPath} is a known private business artifact tracked by Git`);
  }
  if (['.html', '.json', '.md'].includes(extension)) {
    const trackedContent = execFileSync('git', ['show', `:${trackedPath}`], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 5 * 1024 * 1024,
    });
    for (const marker of privateArtifactMarkers) {
      if (trackedContent.includes(marker)) {
        failures.push(`${trackedPath} contains a generated private business marker`);
      }
    }
  }
}

async function checkPublicTree(root: string): Promise<void> {
  for (const path of await walk(root)) {
    const displayPath = relative(projectRoot, path);
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      failures.push(`${displayPath} is a symlink; public source/build output must use real files`);
      continue;
    }

    const extension = extname(path).toLowerCase();
    if (forbiddenPublicExtensions.has(extension)) {
      failures.push(`${displayPath} is a private-export file type in public source/build output`);
      continue;
    }
    if (!searchableExtensions.has(extension)) continue;

    const text = await readFile(path, 'utf8');
    for (const marker of sensitiveMarkers) {
      if (text.includes(marker))
        failures.push(`${displayPath} contains confidential marker: ${marker}`);
    }
  }
}

for (const root of publicRoots) await checkPublicTree(root);
if (checkDist) await checkPublicTree(join(projectRoot, 'dist'));

if (failures.length > 0) {
  console.error('Private-data boundary failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Private-data boundary passed (${trackedFiles.length} tracked files checked; dist ${checkDist ? 'checked' : 'not requested'}).`,
  );
}
