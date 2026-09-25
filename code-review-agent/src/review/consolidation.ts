import type {
  ReviewFinding,
  ReviewRecommendation,
  SpecialistReview,
} from './schemas.js';

function findingKey(finding: ReviewFinding) {
  return [
    finding.file ?? '',
    finding.lineStart ?? '',
    finding.category.toLowerCase(),
    finding.title.toLowerCase(),
  ].join('|');
}

export function deduplicateFindings(
  reviews: SpecialistReview[],
): ReviewFinding[] {
  const findings = reviews.flatMap((review) => review.findings);

  const unique = new Map<string, ReviewFinding>();

  for (const finding of findings) {
    const key = findingKey(finding);

    if (!unique.has(key)) {
      unique.set(key, finding);
    }
  }

  return [...unique.values()];
}

export function getRecommendation(
  findings: ReviewFinding[],
): ReviewRecommendation {
  if (findings.some((finding) => finding.severity === 'critical')) {
    return 'BLOCK MERGE';
  }

  if (findings.some((finding) => finding.severity === 'high')) {
    return 'REQUEST CHANGES';
  }

  if (findings.length > 0) {
    return 'APPROVE WITH COMMENTS';
  }

  return 'APPROVE';
}

export function consolidateReviews(reviews: SpecialistReview[]) {
  const deduplicated = deduplicateFindings(reviews);

  const findings = crossValidateFindings(deduplicated, reviews);

  return {
    findings,
    recommendation: getRecommendation(findings),
  };
}

const blockingSeverities = new Set(['critical', 'high']);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function overlap(a: string, b: string) {
  const left = new Set(normalize(a));
  const right = new Set(normalize(b));

  if (!left.size || !right.size) return 0;

  let matches = 0;

  for (const word of left) {
    if (right.has(word)) matches++;
  }

  return matches / Math.min(left.size, right.size);
}

function independentlyValidates(
  finding: ReviewFinding,
  candidate: ReviewFinding,
) {
  if (finding.agent === candidate.agent) {
    return false;
  }

  if (finding.file && candidate.file && finding.file !== candidate.file) {
    return false;
  }

  return (
    overlap(finding.title, candidate.title) >= 0.5 ||
    overlap(finding.explanation, candidate.explanation) >= 0.55
  );
}

export function crossValidateFindings(
  findings: ReviewFinding[],
  reviews: SpecialistReview[],
) {
  const allFindings = reviews.flatMap((review) => review.findings);

  return findings.map((finding) => {
    if (!blockingSeverities.has(finding.severity)) {
      return finding;
    }

    const validators = allFindings
      .filter((candidate) => independentlyValidates(finding, candidate))
      .map((candidate) => candidate.agent)
      .filter(Boolean);

    return {
      ...finding,
      validatedBy: [...new Set([...finding.validatedBy, ...validators])],
    };
  });
}
