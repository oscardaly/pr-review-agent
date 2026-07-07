import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { PullRequestMetadata } from "../diff/types";

/**
 * A rejected review comment, frozen as an eval case: re-review the original
 * diff and assert the mistake is not repeated. Written by the feedback graph
 * (PR-gated, like lessons), read by the eval runners.
 */
export type RegressionCase = {
  name: string;
  metadata: PullRequestMetadata;
  diff: string;
  /** Keyword groups that must NOT match any published finding. */
  mustNotFlag: string[][];
};

export const REGRESSION_CASES_FILE = "learned/regression-cases.json";

export const loadRegressionCases = async (
  knowledgePath: string,
): Promise<RegressionCase[]> => {
  try {
    const raw = await readFile(
      join(knowledgePath, REGRESSION_CASES_FILE),
      "utf-8",
    );
    return JSON.parse(raw) as RegressionCase[];
  } catch {
    return [];
  }
};
