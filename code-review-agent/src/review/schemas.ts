import { z } from 'zod';
import {
  crossValidateFindings,
  deduplicateFindings,
  getRecommendation,
} from './consolidation.js';

export const severitySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'suggestion',
]);

export const confidenceSchema = z.enum(['high', 'medium', 'low']);

export const findingSchema = z.object({
  title: z.string(),
  category: z.string(),
  severity: severitySchema,
  confidence: confidenceSchema,

  file: z.string().optional(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),

  explanation: z.string(),
  impact: z.string(),
  recommendation: z.string(),

  agent: z.string().default(''),
  validatedBy: z.array(z.string()).default([]),
});

export type ReviewFinding = z.infer<typeof findingSchema>;

export const reviewTargetSchema = z.object({
  type: z.enum(['repository', 'diff', 'commit', 'pull-request']),

  repositoryPath: z.string(),
  reference: z.string().optional(),
  diff: z.string().optional(),
});

export type ReviewTarget = z.infer<typeof reviewTargetSchema>;

export const recommendationSchema = z.enum([
  'APPROVE',
  'APPROVE WITH COMMENTS',
  'REQUEST CHANGES',
  'BLOCK MERGE',
]);

export type ReviewRecommendation = z.infer<typeof recommendationSchema>;

export const specialistReviewRequestSchema = z.object({
  repositoryPath: z.string(),
  diff: z.string(),

  changedFiles: z.array(z.string()).default([]),

  context: z.string().optional(),
});

export type SpecialistReviewRequest = z.infer<
  typeof specialistReviewRequestSchema
>;

export const specialistSchema = z.enum([
  'correctness',
  'security',
  'architecture',
  'performance',
  'quality',
  'testing',
]);

export type Specialist = z.infer<typeof specialistSchema>;

export const specialistReviewSchema = z.object({
  specialist: specialistSchema,

  summary: z.string(),

  findings: z.array(findingSchema),
});

export type SpecialistReview = z.infer<typeof specialistReviewSchema>;

export const supervisorDecisionSchema = z.object({
  specialists: z.array(specialistSchema).min(1),

  reasoning: z.string(),
});

export type SupervisorDecision = z.infer<typeof supervisorDecisionSchema>;

export const activitySchema = z.object({
  stage: z.string(),
  status: z.enum(['completed', 'failed']),
  message: z.string(),
});

export type ReviewActivity = z.infer<typeof activitySchema>;

export const consolidatedReviewSchema = z.object({
  findings: z.array(findingSchema),
  recommendation: recommendationSchema,
});

export type ConsolidatedReview = z.infer<typeof consolidatedReviewSchema>;

export const validationResultSchema = z.object({
  valid: z.boolean(),
  reasoning: z.string(),
});

export type ValidationResult = z.infer<typeof validationResultSchema>;

export function consolidateReviews(reviews: SpecialistReview[]) {
  const deduplicated = deduplicateFindings(reviews);

  const findings = crossValidateFindings(deduplicated, reviews);

  return {
    findings,
    recommendation: getRecommendation(findings),
  };
}
