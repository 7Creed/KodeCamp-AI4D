import type { ReviewTarget } from './schemas.js';
import { getCommitDiff, getWorkingDiff, isGitRepository } from './git.js';
import { getPullRequestDiff } from './pull-request.js';

export interface ResolvedReviewTarget {
  repositoryPath: string;
  diff: string;
  source: ReviewTarget['type'];
  reference?: string;
}

export async function resolveReviewTarget(
  target: ReviewTarget,
): Promise<ResolvedReviewTarget> {
  if (target.type === 'diff') {
    if (!target.diff?.trim()) {
      throw new Error('A diff is required for diff reviews.');
    }

    return {
      repositoryPath: target.repositoryPath,
      diff: target.diff,
      source: 'diff',
    };
  }

  const isRepository = await isGitRepository(target.repositoryPath);

  if (!isRepository) {
    throw new Error('The supplied path is not a Git repository.');
  }

  if (target.type === 'commit') {
    if (!target.reference) {
      throw new Error('A commit reference is required.');
    }

    return {
      repositoryPath: target.repositoryPath,
      diff: await getCommitDiff(target.repositoryPath, target.reference),
      source: 'commit',
      reference: target.reference,
    };
  }

  if (target.type === 'repository') {
    const diff = await getWorkingDiff(target.repositoryPath);

    if (!diff.trim()) {
      throw new Error('The repository has no working-tree changes to review.');
    }

    return {
      repositoryPath: target.repositoryPath,
      diff,
      source: 'repository',
    };
  }

  if (target.type === 'pull-request') {
    if (!target.reference) {
      throw new Error('A GitHub pull request URL is required.');
    }

    return {
      repositoryPath: target.repositoryPath,
      diff: await getPullRequestDiff(target.reference),
      source: 'pull-request',
      reference: target.reference,
    };
  }

  throw new Error(
    'Pull request resolution must be handled by the PR resolver.',
  );
}
