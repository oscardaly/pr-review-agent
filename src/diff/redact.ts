import type { DiffFile } from "./types";

export type Redaction = {
  type: RedactionType;
  file: string;
  line?: number;
};

export type RedactionType = "api-key" | "password" | "email" | "phone";

type RedactionRule = { type: RedactionType; pattern: RegExp };

const REDACTION_RULES: RedactionRule[] = [
  { type: "api-key", pattern: /\b(?:sk|pk)-[A-Za-z0-9_-]{16,}\b/g },
  { type: "api-key", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { type: "api-key", pattern: /\bAKIA[A-Z0-9]{16}\b/g },
  { type: "api-key", pattern: /\bSG\.[A-Za-z0-9._-]{20,}\b/g },
  { type: "api-key", pattern: /\b(?:Bearer|token)\s+[A-Za-z0-9._-]{20,}\b/g },
  {
    type: "password",
    pattern: /((?:password|passwd|secret)\s*[:=]\s*)["'][^"']{4,}["']/gi,
  },
  { type: "email", pattern: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  // Conservative on purpose: only +country-code or (area) forms, so numeric literals in code survive.
  {
    type: "phone",
    pattern:
      /(?:\+\d{1,3}[ -]?\d{2,4}[ -]\d{3,4}[ -]?\d{2,4}|\(\d{3}\)[ -]?\d{3}-\d{4})/g,
  },
];

const placeholderFor = (type: RedactionType): string => `[REDACTED:${type}]`;

const redactText = (text: string): { text: string; types: RedactionType[] } => {
  const types: RedactionType[] = [];
  let redacted = text;
  for (const { type, pattern } of REDACTION_RULES) {
    redacted = redacted.replace(pattern, (_match, ...groups) => {
      types.push(type);
      const leadingCapture = typeof groups[0] === "string" ? groups[0] : "";
      return `${leadingCapture}${placeholderFor(type)}`;
    });
  }
  return { text: redacted, types };
};

/**
 * Redacts secrets and PII in-place at ingestion so nothing downstream — model
 * prompts, LangSmith traces, review output — ever sees the raw values.
 */
export const redactPullRequestFiles = (
  files: DiffFile[],
): { files: DiffFile[]; redactions: Redaction[] } => {
  const redactions: Redaction[] = [];
  const redactedFiles = files.map((file) => ({
    ...file,
    hunks: file.hunks.map((hunk) => ({
      ...hunk,
      lines: hunk.lines.map((line) => {
        const { text, types } = redactText(line.content);
        for (const type of types) {
          redactions.push({ type, file: file.path, line: line.newLineNumber });
        }
        return { ...line, content: text };
      }),
    })),
  }));
  return { files: redactedFiles, redactions };
};
