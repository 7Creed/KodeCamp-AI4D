import fs from 'node:fs/promises';
import path from 'node:path';

const ignoredNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.cache',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
]);

function hasIgnoredSegment(relativePath: string) {
  return relativePath
    .split(path.sep)
    .some((segment) => ignoredNames.has(segment));
}

export function resolveRepositoryPath(
  repositoryRoot: string,
  relativePath: string,
) {
  const root = path.resolve(repositoryRoot);

  const target = path.resolve(root, relativePath);

  const relative = path.relative(root, target);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Requested path is outside the repository.');
  }

  return target;
}

export async function readRepositoryFile(
  repositoryRoot: string,
  relativePath: string,
) {
  const filePath = resolveRepositoryPath(repositoryRoot, relativePath);

  if (hasIgnoredSegment(path.relative(path.resolve(repositoryRoot), filePath))) {
    throw new Error('Access to this path is not allowed.');
  }

  return fs.readFile(filePath, 'utf8');
}

export async function listRepositoryFiles(
  repositoryRoot: string,
  directory = '.',
): Promise<
  Array<{
    name: string;
    type: 'file' | 'directory';
  }>
> {
  const target = resolveRepositoryPath(repositoryRoot, directory);

  if (hasIgnoredSegment(path.relative(path.resolve(repositoryRoot), target))) {
    throw new Error('Access to this path is not allowed.');
  }

  const entries = await fs.readdir(target, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => !ignoredNames.has(entry.name))
    .map((entry) => ({
    name: entry.name,
      type: entry.isDirectory() ? ('directory' as const) : ('file' as const),
    }));
}

export interface RepositorySearchResult {
  file: string;
  line: number;
  content: string;
}

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.mp4',
  '.mp3',
  '.woff',
  '.woff2',
  '.ttf',
]);

export async function searchRepository(
  repositoryRoot: string,
  query: string,
  maxResults = 20,
): Promise<RepositorySearchResult[]> {
  const results: RepositorySearchResult[] = [];

  await searchDirectory(
    repositoryRoot,
    repositoryRoot,
    query.toLowerCase(),
    results,
    maxResults,
  );

  return results;
}

async function searchDirectory(
  repositoryRoot: string,
  directory: string,
  query: string,
  results: RepositorySearchResult[],
  maxResults: number,
): Promise<void> {
  if (results.length >= maxResults) return;

  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (results.length >= maxResults) return;

    if (ignoredNames.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await searchDirectory(
        repositoryRoot,
        absolutePath,
        query,
        results,
        maxResults,
      );

      continue;
    }

    const extension = path.extname(entry.name);

    if (IGNORED_EXTENSIONS.has(extension)) {
      continue;
    }

    const stats = await fs.stat(absolutePath);

    if (stats.size > 1024 * 1024) {
      continue;
    }

    let content: string;

    try {
      content = await fs.readFile(absolutePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    for (let index = 0; index < lines.length; index++) {
      if (lines[index].toLowerCase().includes(query)) {
        results.push({
          file: path.relative(repositoryRoot, absolutePath),
          line: index + 1,
          content: lines[index].trim(),
        });

        if (results.length >= maxResults) {
          return;
        }
      }
    }
  }
}
