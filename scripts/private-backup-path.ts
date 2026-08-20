import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`);
}

function isGitIgnored(projectRoot: string, path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '--', path], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve an existing private snapshot and refuse any path that could become
 * website source, build output or tracked repository content.
 */
export async function resolvePrivateBackupRoot(input: string): Promise<string> {
  const projectRoot = await realpath(resolve('.'));
  const requestedRoot = resolve(input);
  const backupRoot = await realpath(requestedRoot);
  const forbiddenRoots = ['.git', 'public', 'src', 'dist'].map((path) =>
    resolve(projectRoot, path),
  );

  for (const forbiddenRoot of forbiddenRoots) {
    if (isWithin(requestedRoot, forbiddenRoot) || isWithin(backupRoot, forbiddenRoot)) {
      throw new Error(`refusing private output inside ${forbiddenRoot}`);
    }
  }

  if (isWithin(backupRoot, projectRoot)) {
    if (backupRoot === projectRoot || !isGitIgnored(projectRoot, backupRoot)) {
      throw new Error(
        'private backup paths inside this repository must already be excluded by .gitignore',
      );
    }
  }

  return backupRoot;
}

/** Create or validate a real, non-symlinked directory below a validated snapshot root. */
export async function ensurePrivateOutputDirectory(
  backupRoot: string,
  relativePath: string,
): Promise<string> {
  const root = await realpath(backupRoot);
  const segments = relativePath.split(/[\\/]+/).filter(Boolean);
  let current = root;

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error(`invalid private output directory: ${relativePath}`);
    }
    current = join(current, segment);
    try {
      const status = await lstat(current);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error(`private output directory must be a real directory: ${current}`);
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      await mkdir(current, { mode: 0o700 });
    }
  }

  const outputDirectory = await realpath(current);
  if (!isWithin(outputDirectory, root)) {
    throw new Error(`private output directory escapes snapshot root: ${relativePath}`);
  }
  return outputDirectory;
}

/** Replace one private derived file without following an existing output-file symlink. */
export async function writePrivateFileAtomic(
  directory: string,
  filename: string,
  content: string,
): Promise<void> {
  if (basename(filename) !== filename) throw new Error(`invalid private filename: ${filename}`);
  const realDirectory = await realpath(directory);
  if (realDirectory !== directory) {
    throw new Error(`private output directory changed during write: ${directory}`);
  }

  const temporaryPath = join(directory, `.${filename}.${process.pid}.${randomUUID()}.tmp`);
  const targetPath = join(directory, filename);
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

/** Create a private template once while refusing an existing symlink or non-file target. */
export async function writePrivateFileIfMissing(
  directory: string,
  filename: string,
  content: string,
): Promise<void> {
  if (basename(filename) !== filename) throw new Error(`invalid private filename: ${filename}`);
  const realDirectory = await realpath(directory);
  if (realDirectory !== directory) {
    throw new Error(`private output directory changed during write: ${directory}`);
  }

  const targetPath = join(directory, filename);
  try {
    const status = await lstat(targetPath);
    if (status.isSymbolicLink() || !status.isFile()) {
      throw new Error(`private template target must be a real file: ${targetPath}`);
    }
    return;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  const temporaryPath = join(directory, `.${filename}.${process.pid}.${randomUUID()}.tmp`);
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    try {
      await link(temporaryPath, targetPath);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      const status = await lstat(targetPath);
      if (status.isSymbolicLink() || !status.isFile()) {
        throw new Error(`private template target must be a real file: ${targetPath}`, {
          cause: error,
        });
      }
    }
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}
