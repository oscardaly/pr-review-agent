import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { invokeStructured } from "../structured";
import type { ReviewComment } from "../review/types";
import type { GithubClient } from "../tools/github";
import {
  FeedbackClassificationSchema,
  type FeedbackClassification,
} from "./types";

const LESSONS_FILE = "learned/rejected-comments.md";

const CLASSIFY_SYSTEM_PROMPT = [
  "A human replied to one of your code-review comments. Classify the reply.",
  "It is a rejection only if the human states the comment was wrong, unhelpful, or unwanted.",
  "For rejections, extract a lesson: a generalized reviewing rule that would have prevented the comment,",
  "grounded in the human's reasoning.",
].join(" ");

export type FeedbackGraphDependencies = {
  model: BaseChatModel;
  github: GithubClient;
  knowledgePath: string;
};

const FeedbackStateAnnotation = Annotation.Root({
  comment: Annotation<ReviewComment>,
  humanReply: Annotation<string>,
  classification: Annotation<FeedbackClassification | undefined>,
  updatedLessonsFile: Annotation<string | undefined>,
  improvementPrUrl: Annotation<string | undefined>,
});

type FeedbackState = typeof FeedbackStateAnnotation.State;

const renderLessonEntry = ({
  comment,
  humanReply,
  classification,
}: FeedbackState): string =>
  [
    `## Lesson: ${classification!.title}`,
    "",
    `- **Rejected comment:** "${comment.title} — ${comment.body}" (\`${comment.file}\`, ${comment.reviewer} reviewer)`,
    `- **Human reply:** "${humanReply}"`,
    `- **Rule of thumb going forward:** ${classification!.lesson}`,
  ].join("\n");

export const buildFeedbackGraph = (deps: FeedbackGraphDependencies) => {
  const classifyReply = async (state: FeedbackState) => ({
    classification: await invokeStructured(
      deps.model,
      FeedbackClassificationSchema,
      CLASSIFY_SYSTEM_PROMPT,
      `Comment:\n${JSON.stringify(state.comment, null, 2)}\n\nHuman reply:\n${state.humanReply}`,
    ),
  });

  const recordLesson = async (state: FeedbackState) => {
    const existingLessons = await readFile(
      join(deps.knowledgePath, LESSONS_FILE),
      "utf-8",
    );
    return {
      updatedLessonsFile: `${existingLessons.trimEnd()}\n\n${renderLessonEntry(state)}\n`,
    };
  };

  /** The knowledge base only changes via a human-mergeable PR — learning stays reviewable. */
  const openImprovementPr = async (state: FeedbackState) => {
    const { url } = await deps.github.openPullRequest({
      branch: `agent/lesson-${state.classification!.title}`,
      title: `Learn from rejected review comment: ${state.classification!.title}`,
      body: [
        "A reviewer rejected one of my comments. This PR records the lesson in my knowledge base",
        "so the comment validator stops approving comments that repeat the mistake.",
        "",
        renderLessonEntry(state),
      ].join("\n"),
      files: [
        {
          path: `knowledge/${LESSONS_FILE}`,
          content: state.updatedLessonsFile!,
        },
      ],
    });
    return { improvementPrUrl: url };
  };

  const routeAfterClassification = (state: FeedbackState) =>
    state.classification?.type === "rejection" ? "record_lesson" : END;

  return new StateGraph(FeedbackStateAnnotation)
    .addNode("classify_reply", classifyReply)
    .addNode("record_lesson", recordLesson)
    .addNode("open_improvement_pr", openImprovementPr)
    .addEdge(START, "classify_reply")
    .addConditionalEdges("classify_reply", routeAfterClassification, [
      "record_lesson",
      END,
    ])
    .addEdge("record_lesson", "open_improvement_pr")
    .addEdge("open_improvement_pr", END)
    .compile();
};
