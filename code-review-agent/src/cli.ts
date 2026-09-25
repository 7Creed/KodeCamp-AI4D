import { getWorkingDiff } from './review/git.js';
import { runCodeReview } from './review/orchestrator.js';

const repositoryPath = './evaluation/scenario-01-correctness';

async function main() {
  const diff = await getWorkingDiff(repositoryPath);

  if (!diff.trim()) {
    throw new Error('No working-tree changes found.');
  }

  console.log('\nStarting code review...\n');

  const result = await runCodeReview(repositoryPath, diff);

  console.log('\n--- Review Result ---\n');

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Review failed:', error);
  process.exit(1);
});
