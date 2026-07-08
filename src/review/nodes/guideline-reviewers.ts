import type { RunnableConfig } from "@langchain/core/runnables";

import { invokeStructured } from "../../structured";
import type { GuidelineTopic } from "../../rag/knowledge-base";
import type { ReviewGraphDependencies } from "../dependencies";
import type { ReviewState, ReviewStateUpdate } from "../state";
import { DraftFindingsSchema, type ReviewerName } from "../types";
import {
  retrievalQueryFor,
  reviewerSystemPrompt,
  reviewerUserPrompt,
} from "./reviewer-prompts";

type GuidelineReviewerSpec = {
  reviewer: ReviewerName;
  label: string;
  topics: GuidelineTopic[];
  linkTopic: string;
  focus: string;
};

const makeGuidelineReviewer =
  (spec: GuidelineReviewerSpec, deps: ReviewGraphDependencies) =>
  async (
    state: ReviewState,
    config?: RunnableConfig,
  ): Promise<ReviewStateUpdate> => {
    const guidelines = await deps.knowledgeBase.retrieveGuidelines(
      spec.topics,
      retrievalQueryFor(state.pr),
    );
    const links = deps.knowledgeBase.documentationLinksFor(spec.linkTopic);
    const findings = await invokeStructured(
      deps.model,
      DraftFindingsSchema,
      reviewerSystemPrompt(spec.label, spec.focus),
      reviewerUserPrompt(
        state.pr,
        guidelines,
        links,
        deps.knowledgeBase.codeWritingSkill(),
        state.ticket,
      ),
      config,
    );
    return {
      draftComments: findings.comments.map((comment) => ({
        ...comment,
        reviewer: spec.reviewer,
      })),
    };
  };

export const makeStyleReviewer = (deps: ReviewGraphDependencies) =>
  makeGuidelineReviewer(
    {
      reviewer: "style",
      label: "code style",
      topics: ["style", "clean-code"],
      linkTopic: "style",
      focus:
        "Focus on naming, function size and shape, magic values, comments, and readability. Use category slugs like naming, functions, magic-numbers, comments, error-handling, dead-code.",
    },
    deps,
  );

export const makeArchitectureReviewer = (deps: ReviewGraphDependencies) =>
  makeGuidelineReviewer(
    {
      reviewer: "architecture",
      label: "architecture",
      topics: ["architecture", "clean-code"],
      linkTopic: "architecture",
      focus:
        "Focus on module boundaries, layering, leaky abstractions, unwrapped third-party dependencies, and global state. Use category slugs like layering, leaky-abstraction, external-deps, global-state, coupling.",
    },
    deps,
  );
