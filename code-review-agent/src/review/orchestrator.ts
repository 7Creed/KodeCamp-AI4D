import { supervisorAgent } from '../mastra/agents/supervisor-agent.js';
import { correctnessAgent } from '../mastra/agents/correctness-agent.js';
import { securityAgent } from '../mastra/agents/security-agent.js';
import { architectureAgent } from '../mastra/agents/architecture-agent.js';
import { performanceAgent } from '../mastra/agents/performance-agent.js';
import { qualityAgent } from '../mastra/agents/quality-agent.js';
import { testingAgent } from '../mastra/agents/testing-agent.js';
import { withRetry } from './llm-retry.js';
import { consolidateReviews } from './consolidation.js';
import {
  type ReviewFinding,
  type ReviewRecommendation,
  type ReviewActivity,
  specialistReviewSchema,
  supervisorDecisionSchema,
  type Specialist,
  type SpecialistReview,
} from './schemas.js';
import type { ReviewTarget } from './schemas.js';
import { resolveReviewTarget } from './target.js';

const specialistAgents = {
  correctness: correctnessAgent,
  security: securityAgent,
  architecture: architectureAgent,
  performance: performanceAgent,
  quality: qualityAgent,
  testing: testingAgent,
};

async function selectSpecialists(diff: string) {
  const prompt = `
Analyze this Git diff and select only the specialist
reviewers relevant to the change.

Git diff:

${diff}

Do not select specialists without a material reason.
`;
  const response = await withRetry(() =>
    supervisorAgent.generate(prompt, {
      structuredOutput: {
        schema: supervisorDecisionSchema,
        jsonPromptInjection: true,
        errorStrategy: 'strict',
      },
    }),
  );

  return response.object;
}

async function runSpecialist(
  specialist: Specialist,
  repositoryPath: string,
  diff: string,
): Promise<SpecialistReview> {
  const agent = specialistAgents[specialist];

  const prompt = `
Review this code change as the ${specialist} specialist.

Repository:
${repositoryPath}

Git diff:
${diff}

Focus only on issues relevant to your specialty.

Use repository tools when additional context is needed.

Return a structured specialist review.

Set specialist to "${specialist}".

Return ONLY the requested structured review.
Do not include markdown fences, commentary, or text
outside the structured response.

If you find no material issues, still return:
- specialist
- a summary explaining that no material issue was found
- an empty findings array

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

Use severity:
critical, high, medium, low, suggestion.

Use confidence:
high, medium, low.
`;

  const response = await withRetry(() =>
    agent.generate(prompt, {
      structuredOutput: {
        schema: specialistReviewSchema,
        jsonPromptInjection: true,
        errorStrategy: 'strict',
      },
    }),
  );

  let review: SpecialistReview;

  if (response.object) {
    review = specialistReviewSchema.parse(response.object);
  } else {
    const cleaned = response.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      review = specialistReviewSchema.parse(JSON.parse(cleaned));
    } catch {
      throw new Error(
        `${specialist} specialist returned invalid structured output.\n\n` +
          `Raw response:\n${response.text}`,
      );
    }
  }

  return {
    ...review,
    specialist,
    findings: review.findings.map((finding) => ({
      ...finding,
      agent: specialist,
      validatedBy: finding.validatedBy ?? [],
    })),
  };
}

export async function reviewTarget(target: ReviewTarget) {
  const resolved = await resolveReviewTarget(target);

  return runCodeReview(resolved.repositoryPath, resolved.diff);
}

export interface ReviewExecution {
  supervisor: {
    specialists: Specialist[];
    reasoning: string;
  };
  reviews: SpecialistReview[];
  findings: ReviewFinding[];
  recommendation: ReviewRecommendation;
  activity: ReviewActivity[];
}

export async function runCodeReview(
  repositoryPath: string,
  diff: string,
): Promise<ReviewExecution> {
  const activity: ReviewActivity[] = [];

  const supervisor = await selectSpecialists(diff);

  activity.push({
    stage: 'supervisor',
    status: 'completed',
    message: `Selected: ${supervisor.specialists.join(', ')}`,
  });

  console.log(`Selected specialists: ${supervisor.specialists.join(', ')}`);

  const reviews: SpecialistReview[] = [];

  for (const specialist of supervisor.specialists) {
    console.log(`Running ${specialist} specialist...`);

    try {
      const review = await runSpecialist(specialist, repositoryPath, diff);

      reviews.push(review);

      activity.push({
        stage: specialist,
        status: 'completed',
        message: `${specialist} review completed.`,
      });
    } catch (error) {
      console.warn(
        `${specialist} specialist failed:`,
        error instanceof Error ? error.message : String(error),
      );

      activity.push({
        stage: specialist,
        status: 'failed',
        message:
          error instanceof Error ? error.message : 'Specialist review failed.',
      });
    }
  }

  if (reviews.length === 0) {
    throw new Error('All selected specialist reviews failed.');
  }

  const consolidated = consolidateReviews(reviews);

  activity.push({
    stage: 'consolidation',
    status: 'completed',
    message: `Final recommendation: ${consolidated.recommendation}`,
  });

  return {
    supervisor,
    reviews,
    findings: consolidated.findings,
    recommendation: consolidated.recommendation,
    activity,
  };
}
