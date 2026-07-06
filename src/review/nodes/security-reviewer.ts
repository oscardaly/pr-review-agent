import { invokeStructured } from "../../structured";
import { createSemgrepTool } from "../../tools/semgrep";
import type { ReviewGraphDependencies } from "../dependencies";
import type { ReviewState, ReviewStateUpdate } from "../state";
import { DraftFindingsSchema } from "../types";
import {
  retrievalQueryFor,
  reviewerSystemPrompt,
  reviewerUserPrompt,
} from "./reviewer-prompts";

const SECURITY_FOCUS = [
  "Focus on OWASP Top 10 risks in the added code.",
  "You are given the output of a semgrep static-analysis scan: triage each hit (explain the risk, give a concrete fix, keep its OWASP category in the comment body),",
  "then look for OWASP issues the scanner cannot catch (missing auth checks, IDOR, trust in client-supplied fields).",
  "Use category slugs like injection, secrets, xss, transport, auth, access-control, ssrf.",
].join(" ");

/**
 * Deterministic tool first, model second: semgrep supplies ground-truth hits
 * the model must triage, so a lazy model can't just say "looks fine".
 */
export const makeSecurityReviewer =
  (deps: ReviewGraphDependencies) =>
  async (state: ReviewState): Promise<ReviewStateUpdate> => {
    const semgrepTool = createSemgrepTool(state.pr.files, deps.semgrepScanner);
    const semgrepReport = await semgrepTool.invoke({});
    const guidelines = await deps.knowledgeBase.retrieveGuidelines(
      ["security"],
      retrievalQueryFor(state.pr),
    );
    const links = deps.knowledgeBase.documentationLinksFor("security");

    const userPrompt = [
      `Semgrep scan results (JSON):\n${semgrepReport}`,
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
      reviewerSystemPrompt("security", SECURITY_FOCUS),
      userPrompt,
    );
    return {
      draftComments: findings.comments.map((comment) => ({
        ...comment,
        reviewer: "security" as const,
      })),
    };
  };
