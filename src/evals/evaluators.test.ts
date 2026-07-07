import { describe, expect, test } from "bun:test";

import {
  scoreCleanliness,
  scoreDocsImpact,
  scoreFindingRecall,
  scoreRegression,
} from "./evaluators";

const outputsWith = (
  findings: string[],
  severities: string[] = [],
  docsNeedUpdate = false,
) => ({
  findings,
  severities,
  docsNeedUpdate,
});

describe("scoreFindingRecall", () => {
  test("gives full marks when every required finding matches an alternative keyword", () => {
    const score = scoreFindingRecall(
      { mustFlag: [["injection", "sql"]] },
      outputsWith(["injection SQL built from user input"]),
    );

    expect(score.score).toBe(1);
  });

  test("gives partial credit per missed finding", () => {
    const score = scoreFindingRecall(
      { mustFlag: [["injection"], ["secrets", "credential"]] },
      outputsWith(["injection unparameterized query"]),
    );

    expect(score.score).toBe(0.5);
  });

  test("is vacuously perfect when nothing is required", () => {
    expect(scoreFindingRecall({ mustFlag: [] }, outputsWith([])).score).toBe(1);
  });
});

describe("scoreCleanliness", () => {
  test("fails a clean-diff case when the agent raises warnings", () => {
    const score = scoreCleanliness(
      { mustFlag: [], expectClean: true },
      outputsWith(["x"], ["warning"]),
    );

    expect(score.score).toBe(0);
  });

  test("passes a clean-diff case when only info comments are raised", () => {
    const score = scoreCleanliness(
      { mustFlag: [], expectClean: true },
      outputsWith(["x"], ["info"]),
    );

    expect(score.score).toBe(1);
  });
});

describe("scoreRegression", () => {
  test("fails when a previously rejected comment reappears", () => {
    const score = scoreRegression(
      { mustFlag: [], mustNotFlag: [["functions", "map", "join"]] },
      outputsWith(["functions Use .map()/.join() instead of a loop"]),
    );

    expect(score.score).toBe(0);
  });

  test("passes when the rejected comment stays gone", () => {
    const score = scoreRegression(
      { mustFlag: [], mustNotFlag: [["functions", "map", "join"]] },
      outputsWith(["injection SQL built from user input"]),
    );

    expect(score.score).toBe(1);
  });

  test("is vacuously perfect without regression guards", () => {
    expect(scoreRegression({ mustFlag: [] }, outputsWith(["x"])).score).toBe(1);
  });
});

describe("scoreDocsImpact", () => {
  test("checks the docs flag against the expectation when asserted", () => {
    expect(
      scoreDocsImpact(
        { mustFlag: [], docsImpactExpected: true },
        outputsWith([], [], true),
      ).score,
    ).toBe(1);
    expect(
      scoreDocsImpact(
        { mustFlag: [], docsImpactExpected: true },
        outputsWith([], [], false),
      ).score,
    ).toBe(0);
  });
});
