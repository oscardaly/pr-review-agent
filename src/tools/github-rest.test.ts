import { describe, expect, test } from "bun:test";

import type { ValidatedComment } from "../review/types";
import { createRestGithubClient } from "./github-rest";

const commentWith = (
  overrides: Partial<ValidatedComment>,
): ValidatedComment => ({
  reviewer: "security",
  file: "src/app/api/export/route.ts",
  line: 15,
  severity: "critical",
  category: "injection",
  title: "SQL injection via template literal",
  body: "customerId flows into the query unparameterized.",
  takeaway: "Parameterize.",
  citations: [],
  validation: { verdict: "keep", confidence: 0.95, reasoning: "real" },
  ...overrides,
});

type RecordedRequest = { url: string; payload: Record<string, unknown> };

const fakeFetch = (
  responses: Array<{ status: number; body: unknown }>,
  recorded: RecordedRequest[],
): typeof fetch =>
  (async (url: unknown, init?: RequestInit) => {
    recorded.push({
      url: String(url),
      payload: JSON.parse(String(init?.body)),
    });
    const next = responses[Math.min(recorded.length - 1, responses.length - 1)]!;
    return new Response(JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;

const clientWith = (
  responses: Array<{ status: number; body: unknown }>,
  recorded: RecordedRequest[],
) =>
  createRestGithubClient({
    token: "test-token",
    repository: "acme/storefront",
    fetchImplementation: fakeFetch(responses, recorded),
  });

describe("createRestGithubClient", () => {
  test("posts a review with line-anchored inline comments and the summary as body", async () => {
    const recorded: RecordedRequest[] = [];
    const client = clientWith(
      [{ status: 200, body: { html_url: "https://github.com/r/pull/7#review-1" } }],
      recorded,
    );

    const { url } = await client.postReview({
      prNumber: 7,
      markdown: "FULL REVIEW",
      summaryMarkdown: "SUMMARY ONLY",
      comments: [commentWith({})],
    });

    expect(url).toBe("https://github.com/r/pull/7#review-1");
    expect(recorded[0]!.url).toBe(
      "https://api.github.com/repos/acme/storefront/pulls/7/reviews",
    );
    expect(recorded[0]!.payload.event).toBe("COMMENT");
    expect(recorded[0]!.payload.body).toBe("SUMMARY ONLY");
    expect(recorded[0]!.payload.comments).toEqual([
      {
        path: "src/app/api/export/route.ts",
        line: 15,
        side: "RIGHT",
        body: expect.stringContaining("SQL injection via template literal"),
      },
    ]);
  });

  test("folds comments without a line number into the review body", async () => {
    const recorded: RecordedRequest[] = [];
    const client = clientWith(
      [{ status: 200, body: { html_url: "https://github.com/r/pull/7#review-2" } }],
      recorded,
    );

    await client.postReview({
      prNumber: 7,
      markdown: "FULL REVIEW",
      summaryMarkdown: "SUMMARY ONLY",
      comments: [commentWith({ line: undefined, title: "General concern" })],
    });

    expect(recorded[0]!.payload.comments).toEqual([]);
    expect(recorded[0]!.payload.body).toContain("SUMMARY ONLY");
    expect(recorded[0]!.payload.body).toContain("could not be anchored");
    expect(recorded[0]!.payload.body).toContain("General concern");
  });

  test("falls back to a body-only review when inline anchoring is rejected", async () => {
    const recorded: RecordedRequest[] = [];
    const client = clientWith(
      [
        { status: 422, body: { message: "line must be part of the diff" } },
        { status: 200, body: { html_url: "https://github.com/r/pull/7#review-3" } },
      ],
      recorded,
    );

    const { url } = await client.postReview({
      prNumber: 7,
      markdown: "FULL REVIEW",
      summaryMarkdown: "SUMMARY ONLY",
      comments: [commentWith({})],
    });

    expect(url).toBe("https://github.com/r/pull/7#review-3");
    expect(recorded).toHaveLength(2);
    expect(recorded[1]!.payload.body).toBe("FULL REVIEW");
    expect(recorded[1]!.payload.comments).toBeUndefined();
  });

  test("surfaces non-anchoring API failures with status and detail", async () => {
    const client = clientWith([{ status: 401, body: { message: "Bad credentials" } }], []);

    expect(
      client.postReview({
        prNumber: 7,
        markdown: "FULL",
        summaryMarkdown: "SUMMARY",
        comments: [commentWith({})],
      }),
    ).rejects.toThrow("401");
  });

  test("openPullRequest is review-posting only", async () => {
    const client = clientWith([], []);

    expect(
      client.openPullRequest({ branch: "b", title: "t", body: "b", files: [] }),
    ).rejects.toThrow("posts reviews only");
  });
});
