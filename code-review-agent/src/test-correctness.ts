import { specialistReviewSchema } from './review/schemas.js';
import { correctnessAgent } from './mastra/agents/correctness-agent.js';
import { getWorkingDiff } from './review/git.js';

const repositoryPath = './evaluation/scenario-01-correctness';

async function generateWithRetry(prompt: string, retries = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await correctnessAgent.generate(prompt, {
        structuredOutput: {
          schema: specialistReviewSchema,
          jsonPromptInjection: true,
          errorStrategy: 'strict',
        },
      });
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      const delay = attempt * 2000;

      console.warn(`Model request failed. Retrying in ${delay / 1000}s...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function main() {
  const diff = await getWorkingDiff(repositoryPath);

  if (!diff.trim()) {
    throw new Error('No Git diff found.');
  }

  console.log('\n--- Git Diff ---\n');
  console.log(diff);

  console.log('\n--- Correctness Review ---\n');

  const prompt = `
Review the following code change for correctness and logic issues.

Repository:
${repositoryPath}

Git diff:
${diff}

Focus only on material correctness problems.

You may inspect the repository using your tools when
additional context is necessary.

Return a structured specialist review.

Set:
- specialist to "correctness"
- summary to a concise summary of the review

For every finding provide:
- title
- category
- severity
- confidence
- file where possible
- lineStart and lineEnd where possible
- explanation
- impact
- recommendation

Use only these severity values:
critical, high, medium, low, suggestion.

Use only these confidence values:
high, medium, low.
`;

  //   const response = await correctnessAgent.generate(prompt);

  const response = await generateWithRetry(prompt);

  //   console.log(response.text);
  //   console.log(JSON.stringify(response.object, null, 2));
  console.log('\nStructured object:', JSON.stringify(response.object, null, 2));

  console.log('\nRaw text:', response.text);
}

main().catch((error) => {
  console.error('Review failed:', error);
  process.exit(1);
});
