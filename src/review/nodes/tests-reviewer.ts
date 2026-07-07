import { invokeStructured } from "../../structured";
import { createTestMappingTool } from "../../tools/test-mapping";
import type { ReviewGraphDependencies } from "../dependencies";
import type { ReviewState, ReviewStateUpdate } from "../state";
import { DraftFindingsSchema } from "../types";
import {
  retrievalQueryFor,
  reviewerSystemPrompt,
  reviewerUserPrompt,
} from "./reviewer-prompts";

const TESTS_FOCUS = [
  "Focus on testing gaps in the added code.",
  "You are given a deterministic test-mapping report: which changed source files had no test file touched in the same PR.",
  "Judge which gaps actually matter — new logic, branching, and error paths need tests; type-only, config, and trivial changes do not.",
  "Name the specific behaviour that deserves a test (the boundary condition, the error path), never a blanket 'add tests'.",
  "Use category slugs like missing-tests, test-quality, boundary-conditions.",
].join(" ");

/**
 * Deterministic tool first, model second (same shape as the security
 * reviewer): the mapping supplies which files changed untested, the model
 * judges which of those gaps a senior engineer would actually flag.
 */
export const makeTestsReviewer =
  (deps: ReviewGraphDependencies) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const testMappingTool = createTestMappingTool(state.pr.files);
    const mappingReport = await testMappingTool.invoke({});
    const guidelines = await deps.knowledgeBase.retrieveGuidelines(
      ["clean-code"],
      retrievalQueryFor(state.pr),
    );
    const links = deps.knowledgeBase.documentationLinksFor("clean-code");

    const userPrompt = [
      `Test-mapping report (JSON):\n${mappingReport}`,
      "",
      reviewerUserPrompt(
        state.pr,
        guidelines,
        links,
        deps.knowledgeBase.codeWritingSkill(),
      ),
    ].join("\n");

    const findings = await invokeStructured(
      deps.model,
      DraftFindingsSchema,
      reviewerSystemPrompt("tests", TESTS_FOCUS),
      userPrompt,
    );
    return {
      draftComments: findings.comments.map((comment) => ({
        ...comment,
        reviewer: "tests" as const,
      })),
    };
  };
