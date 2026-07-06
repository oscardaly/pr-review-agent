import { AGENT_NAME, AGENT_SIGNOFF } from "../persona";
import type { ReviewState } from "./state";
import type { ValidatedComment } from "./types";

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;
const SEVERITY_BADGES = { critical: "🔴", warning: "🟡", info: "🔵" } as const;

const verdictLine = (comments: ValidatedComment[]): string => {
  if (comments.some((comment) => comment.severity === "critical"))
    return "🔴 **Request changes**";
  if (comments.some((comment) => comment.severity === "warning"))
    return "🟡 **Comments to address**";
  return "🟢 **Looks good** — minor notes only";
};

const renderCitations = (comment: ValidatedComment): string =>
  comment.citations.length
    ? `  \n  Sources: ${comment.citations.map((citation) => `[${citation.title}](${citation.url})`).join(" · ")}`
    : "";

const renderComment = (comment: ValidatedComment): string =>
  [
    `- ${SEVERITY_BADGES[comment.severity]} **\`${comment.file}${comment.line ? `:${comment.line}` : ""}\`** — ${comment.title}`,
    `  ${comment.body}`,
    comment.suggestion
      ? `  \n  Suggested fix:\n  \`\`\`\n  ${comment.suggestion}\n  \`\`\``
      : "",
    `  \n  🎓 **Takeaway:** ${comment.takeaway}`,
    comment.guideline
      ? `  \n  _Guideline: ${comment.guideline} (${comment.reviewer} reviewer)_`
      : "",
    renderCitations(comment),
  ]
    .filter(Boolean)
    .join("\n");

const renderDocsImpact = (state: ReviewState): string => {
  if (!state.docsImpact?.needsUpdate)
    return "No user-facing documentation appears affected.";
  return state.docsImpact.items
    .map(
      (item) =>
        `- **${item.document}** — ${item.reason}\n  Suggested update: ${item.suggestedUpdate}`,
    )
    .join("\n");
};

export const renderReviewMarkdown = (state: ReviewState): string => {
  const comments = [...state.validatedComments].sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity],
  );
  return [
    `# ${AGENT_NAME}'s review of PR #${state.pr.number}: ${state.pr.title}`,
    "",
    `Hey @${state.pr.author} 👋 thanks for the PR! Here's what caught my eye — each note comes with the reasoning and a takeaway you can reuse.`,
    "",
    verdictLine(comments),
    "",
    `> ${state.pr.files.length} file(s) reviewed · ${comments.length} comment(s) published · ` +
      `${state.droppedComments.length} draft(s) dropped by the validator · ` +
      `${state.redactions.length} secret/PII value(s) redacted before analysis`,
    "",
    "## Findings",
    comments.length
      ? comments.map(renderComment).join("\n\n")
      : "_No issues worth raising — nice work._",
    "",
    "## Documentation impact",
    renderDocsImpact(state),
    "",
    "---",
    AGENT_SIGNOFF,
    "",
    `_Think a comment is wrong? Reply to it and run \`bun run feedback\` — ${AGENT_NAME} records the lesson and opens a PR against his own knowledge base._`,
  ].join("\n");
};
