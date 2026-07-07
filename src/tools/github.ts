import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ValidatedComment } from "../review/types";

export type PublishedReview = {
  prNumber: number;
  /** The complete review, findings included — what a human reads as one document. */
  markdown: string;
  /** The review without the findings section — the body when comments are posted inline instead. */
  summaryMarkdown: string;
  comments: ValidatedComment[];
};

export type ImprovementPullRequest = {
  branch: string;
  title: string;
  body: string;
  files: { path: string; content: string }[];
};

export type GithubClient = {
  postReview: (review: PublishedReview) => Promise<{ url: string }>;
  openPullRequest: (
    proposal: ImprovementPullRequest,
  ) => Promise<{ url: string }>;
};

/**
 * Stub GitHub client: writes what WOULD be sent to the GitHub API into the
 * output directory, so a demo run is inspectable and side-effect free.
 * Swapping in Octokit touches only this file — callers see the same interface.
 */
export const createFileSystemGithubClient = (
  outputPath: string,
): GithubClient => ({
  postReview: async ({ prNumber, markdown, comments }) => {
    const reviewDirectory = join(outputPath, `pr-${prNumber}`);
    await mkdir(reviewDirectory, { recursive: true });
    await writeFile(join(reviewDirectory, "review.md"), markdown);
    await writeFile(
      join(reviewDirectory, "comments.json"),
      JSON.stringify(comments, null, 2),
    );
    return { url: join(reviewDirectory, "review.md") };
  },

  openPullRequest: async ({ branch, title, body, files }) => {
    const proposalDirectory = join(outputPath, "improvement-prs", branch);
    await mkdir(proposalDirectory, { recursive: true });
    await writeFile(
      join(proposalDirectory, "PR.md"),
      `# ${title}\n\n${body}\n`,
    );
    for (const file of files) {
      const safeName = file.path.replaceAll("/", "__");
      await writeFile(join(proposalDirectory, safeName), file.content);
    }
    return { url: join(proposalDirectory, "PR.md") };
  },
});
