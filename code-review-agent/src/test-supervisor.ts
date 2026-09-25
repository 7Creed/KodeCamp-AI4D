import { supervisorAgent } from './mastra/agents/supervisor-agent.js';
import { getWorkingDiff } from './review/git.js';
import { supervisorDecisionSchema } from './review/schemas.js';

const repositoryPath = './evaluation/scenario-01-correctness';

async function main() {
  const diff = await getWorkingDiff(repositoryPath);

  if (!diff.trim()) {
    throw new Error('No Git diff found.');
  }

  const prompt = `
Select the specialist reviewers needed for this change.

Git diff:

${diff}

Return only specialists that are relevant to the change.
`;

  const response = await supervisorAgent.generate(prompt, {
    structuredOutput: {
      schema: supervisorDecisionSchema,
      jsonPromptInjection: true,
      errorStrategy: 'strict',
    },
  });

  console.log(JSON.stringify(response.object, null, 2));
}

main().catch((error) => {
  console.error('Supervisor test failed:', error);

  process.exit(1);
});
