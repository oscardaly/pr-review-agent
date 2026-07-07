export type EvalExpectation = {
  /** Each inner array lists acceptable category/title keywords for one required finding. */
  mustFlag: string[][];
  /** Each inner array lists keywords of a previously rejected comment that must NOT reappear. */
  mustNotFlag?: string[][];
  /** True when the diff is fine and the agent should keep quiet (no warning/critical comments). */
  expectClean?: boolean;
  /** True when the diff should trigger a documentation-update flag. */
  docsImpactExpected?: boolean;
};

export type EvalOutputs = {
  /** "category title" strings for every published comment. */
  findings: string[];
  severities: string[];
  docsNeedUpdate: boolean;
};

export type EvalScore = { key: string; score: number; comment: string };

const matchesAnyKeyword = (findings: string[], keywords: string[]): boolean =>
  findings.some((finding) =>
    keywords.some((keyword) =>
      finding.toLowerCase().includes(keyword.toLowerCase()),
    ),
  );

export const scoreFindingRecall = (
  expected: EvalExpectation,
  outputs: EvalOutputs,
): EvalScore => {
  if (expected.mustFlag.length === 0) {
    return { key: "finding_recall", score: 1, comment: "no required findings" };
  }
  const found = expected.mustFlag.filter((keywords) =>
    matchesAnyKeyword(outputs.findings, keywords),
  );
  return {
    key: "finding_recall",
    score: found.length / expected.mustFlag.length,
    comment: `found ${found.length}/${expected.mustFlag.length} required findings`,
  };
};

export const scoreCleanliness = (
  expected: EvalExpectation,
  outputs: EvalOutputs,
): EvalScore => {
  if (!expected.expectClean) {
    return { key: "clean_pass", score: 1, comment: "not a clean-diff case" };
  }
  const noiseCount = outputs.severities.filter(
    (severity) => severity !== "info",
  ).length;
  return {
    key: "clean_pass",
    score: noiseCount === 0 ? 1 : 0,
    comment:
      noiseCount === 0
        ? "stayed quiet on a clean diff"
        : `raised ${noiseCount} warning/critical comment(s) on a clean diff`,
  };
};

/** Regression guard: a rejected comment must stay rejected on the diff that earned the lesson. */
export const scoreRegression = (
  expected: EvalExpectation,
  outputs: EvalOutputs,
): EvalScore => {
  if (!expected.mustNotFlag?.length) {
    return { key: "regression_pass", score: 1, comment: "no rejected-comment guards" };
  }
  const repeated = expected.mustNotFlag.filter((keywords) =>
    matchesAnyKeyword(outputs.findings, keywords),
  );
  return {
    key: "regression_pass",
    score: repeated.length === 0 ? 1 : 0,
    comment:
      repeated.length === 0
        ? "no rejected comment repeated"
        : `repeated ${repeated.length} previously rejected comment(s)`,
  };
};

export const scoreDocsImpact = (
  expected: EvalExpectation,
  outputs: EvalOutputs,
): EvalScore => {
  if (expected.docsImpactExpected === undefined) {
    return {
      key: "docs_impact",
      score: 1,
      comment: "docs impact not asserted",
    };
  }
  const correct = outputs.docsNeedUpdate === expected.docsImpactExpected;
  return {
    key: "docs_impact",
    score: correct ? 1 : 0,
    comment: correct
      ? "docs impact judged correctly"
      : `expected needsUpdate=${expected.docsImpactExpected}, got ${outputs.docsNeedUpdate}`,
  };
};

export const scoreExample = (
  expected: EvalExpectation,
  outputs: EvalOutputs,
): EvalScore[] => [
  scoreFindingRecall(expected, outputs),
  scoreCleanliness(expected, outputs),
  scoreDocsImpact(expected, outputs),
  scoreRegression(expected, outputs),
];
