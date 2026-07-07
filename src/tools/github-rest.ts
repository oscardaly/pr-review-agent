import { renderInlineComment } from "../review/render-review";
import type { ValidatedComment } from "../review/types";
import type { GithubClient, PublishedReview } from "./github";

export type RestGithubClientOptions = {
  token: string;
  /** "owner/repo" */
  repository: string;
  apiBaseUrl?: string;
  /** Injectable for tests — the client never talks to the network in the suite. */
  fetchImplementation?: typeof fetch;
};

type GithubReviewResponse = { html_url: string };

const hasAnchor = (
  comment: ValidatedComment,
): comment is ValidatedComment & { line: number } =>
  typeof comment.line === "number";

const renderUnanchoredSection = (comments: ValidatedComment[]): string =>
  [
    "## Notes that could not be anchored to a line",
    "",
    ...comments.map(
      (comment) => `**\`${comment.file}\`**\n\n${renderInlineComment(comment)}`,
    ),
  ].join("\n");

/**
 * Real GitHub client over the REST API with plain fetch — no SDK dependency,
 * same GithubClient interface as the filesystem stub. Reviews are posted as
 * event COMMENT (Leo advises; humans decide what blocks a merge), with
 * comments anchored via the modern path/line/side fields.
 */
export const createRestGithubClient = (
  options: RestGithubClientOptions,
): GithubClient => {
  const {
    token,
    repository,
    apiBaseUrl = "https://api.github.com",
    fetchImplementation = fetch,
  } = options;

  const post = async <T>(path: string, payload: unknown): Promise<T> => {
    const response = await fetchImplementation(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw Object.assign(
        new Error(`GitHub API ${path} failed: ${response.status} ${detail}`),
        { status: response.status },
      );
    }
    return (await response.json()) as T;
  };

  const postReviewPayload = (
    prNumber: number,
    payload: unknown,
  ): Promise<GithubReviewResponse> =>
    post<GithubReviewResponse>(
      `/repos/${repository}/pulls/${prNumber}/reviews`,
      payload,
    );

  return {
    postReview: async ({ prNumber, markdown, summaryMarkdown, comments }: PublishedReview) => {
      const anchoredComments = comments.filter(hasAnchor);
      const unanchoredComments = comments.filter(
        (comment) => !hasAnchor(comment),
      );
      const body = unanchoredComments.length
        ? `${summaryMarkdown}\n\n${renderUnanchoredSection(unanchoredComments)}`
        : summaryMarkdown;

      try {
        const review = await postReviewPayload(prNumber, {
          body,
          event: "COMMENT",
          comments: anchoredComments.map((comment) => ({
            path: comment.file,
            line: comment.line,
            side: "RIGHT",
            body: renderInlineComment(comment),
          })),
        });
        return { url: review.html_url };
      } catch (error) {
        // 422 = at least one comment failed to anchor to the diff. Retry once
        // with everything in the body — a complete review beats a lost one.
        if ((error as { status?: number }).status !== 422) throw error;
        const review = await postReviewPayload(prNumber, {
          body: markdown,
          event: "COMMENT",
        });
        return { url: review.html_url };
      }
    },

    openPullRequest: async () => {
      throw new Error(
        "The REST GitHub client posts reviews only — improvement PRs are proposed via the filesystem client (run `bun run feedback` locally).",
      );
    },
  };
};
