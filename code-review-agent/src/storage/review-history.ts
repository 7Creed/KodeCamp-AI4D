import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ReviewTarget } from '../review/schemas.js';
import type { ReviewExecution } from '../review/orchestrator.js';

const HISTORY_DIR = path.resolve('data/reviews');

export interface StoredReview {
  id: string;
  createdAt: string;
  target: ReviewTarget;
  result: ReviewExecution;
}

export async function saveReview(
  target: ReviewTarget,
  result: ReviewExecution,
): Promise<StoredReview> {
  await mkdir(HISTORY_DIR, { recursive: true });

  const review: StoredReview = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    target,
    result,
  };

  await writeFile(
    path.join(HISTORY_DIR, `${review.id}.json`),
    JSON.stringify(review, null, 2),
    'utf8',
  );

  return review;
}

export async function listReviews(): Promise<StoredReview[]> {
  await mkdir(HISTORY_DIR, { recursive: true });

  const files = await readdir(HISTORY_DIR);

  const reviews = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        const content = await readFile(path.join(HISTORY_DIR, file), 'utf8');

        return JSON.parse(content) as StoredReview;
      }),
  );

  return reviews.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export async function getReview(id: string): Promise<StoredReview | null> {
  try {
    const content = await readFile(
      path.join(HISTORY_DIR, `${id}.json`),
      'utf8',
    );

    return JSON.parse(content) as StoredReview;
  } catch {
    return null;
  }
}
