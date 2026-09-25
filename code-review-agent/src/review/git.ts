import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runGit(repositoryPath: string, args: string[]) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repositoryPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout;
}

export async function getWorkingDiff(repositoryPath: string) {
  return runGit(repositoryPath, ['diff', '--no-ext-diff']);
}

export async function getStagedDiff(repositoryPath: string) {
  return runGit(repositoryPath, ['diff', '--cached', '--no-ext-diff']);
}

export async function getCommitDiff(repositoryPath: string, commit: string) {
  return runGit(repositoryPath, [
    'show',
    '--format=fuller',
    '--no-ext-diff',
    commit,
  ]);
}

export async function isGitRepository(repositoryPath: string) {
  try {
    const result = await runGit(repositoryPath, [
      'rev-parse',
      '--is-inside-work-tree',
    ]);

    return result.trim() === 'true';
  } catch {
    return false;
  }
}

export async function getChangedFiles(repositoryPath: string) {
  const output = await runGit(repositoryPath, ['diff', '--name-only']);

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

export async function getCommitChangedFiles(
  repositoryPath: string,
  commit: string,
) {
  const output = await runGit(repositoryPath, [
    'show',
    '--pretty=format:',
    '--name-only',
    commit,
  ]);

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}
