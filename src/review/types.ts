import { z } from "zod";

export const ReviewerNameSchema = z.enum([
  "style",
  "architecture",
  "security",
  "tests",
]);
export type ReviewerName = z.infer<typeof ReviewerNameSchema>;

export const CitationSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const DraftCommentSchema = z.object({
  file: z.string().describe("Path of the changed file the comment applies to"),
  line: z
    .number()
    .optional()
    .describe("New-file line number the comment anchors to"),
  severity: z.enum(["info", "warning", "critical"]),
  category: z
    .string()
    .describe(
      "Kebab-case slug like naming, magic-numbers, injection, secrets, layering, error-handling",
    ),
  title: z.string().describe("One-line summary of the issue"),
  body: z
    .string()
    .describe("2-4 sentence explanation grounded in the cited guideline"),
  suggestion: z
    .string()
    .optional()
    .describe("Concrete replacement code or refactor, if one exists"),
  takeaway: z
    .string()
    .describe(
      "The transferable lesson: the general principle behind this comment and how to recognise the situation next time, phrased for the PR author",
    ),
  citations: z
    .array(CitationSchema)
    .describe("Official documentation links supporting the comment"),
  guideline: z
    .string()
    .optional()
    .describe("Heading of the knowledge-base section this comment is based on"),
});

export const DraftFindingsSchema = z.object({
  comments: z.array(DraftCommentSchema),
});

export const ReviewCommentSchema = DraftCommentSchema.extend({
  reviewer: ReviewerNameSchema,
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

export const ValidationVerdictSchema = z.object({
  verdict: z.enum(["keep", "drop"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const ValidatedCommentSchema = ReviewCommentSchema.extend({
  validation: ValidationVerdictSchema,
});
export type ValidatedComment = z.infer<typeof ValidatedCommentSchema>;

export const DocsImpactSchema = z.object({
  needsUpdate: z.boolean(),
  items: z.array(
    z.object({
      document: z.string().describe("Path of the user-facing document"),
      reason: z.string().describe("What in this PR makes the document stale"),
      suggestedUpdate: z
        .string()
        .describe("What the documentation change should say"),
    }),
  ),
});

export type DocsImpact = z.infer<typeof DocsImpactSchema>;
