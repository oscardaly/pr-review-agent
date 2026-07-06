import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { DiffFile } from "../diff/types";
import { BUILTIN_SEMGREP_RULES } from "./semgrep-rules";

export type SemgrepFinding = {
  ruleId: string;
  owaspCategory: string;
  severity: "warning" | "error";
  message: string;
  file: string;
  line: number;
};

export type SemgrepScanner = (files: DiffFile[]) => SemgrepFinding[];

/**
 * Scans only ADDED lines — the review should own what the PR introduces,
 * not lint the whole repository. Stands in for the semgrep binary (which needs
 * full checked-out files); the interface is the seam where the real CLI plugs in.
 */
export const scanWithBuiltinRules: SemgrepScanner = (files) =>
  files.flatMap((file) =>
    file.hunks.flatMap((hunk) =>
      hunk.lines
        .filter((line) => line.kind === "added")
        .flatMap((line) =>
          BUILTIN_SEMGREP_RULES.filter((rule) =>
            rule.pattern.test(line.content),
          ).map((rule) => ({
            ruleId: rule.ruleId,
            owaspCategory: rule.owaspCategory,
            severity: rule.severity,
            message: rule.message,
            file: file.path,
            line: line.newLineNumber ?? 0,
          })),
        ),
    ),
  );

/** Wraps the scanner as a LangChain tool so every scan is a traced tool run in LangSmith. */
export const createSemgrepTool = (
  files: DiffFile[],
  scanner: SemgrepScanner = scanWithBuiltinRules,
) =>
  tool(
    async ({ paths }): Promise<string> => {
      const scopedFiles = paths?.length
        ? files.filter((file) => paths.includes(file.path))
        : files;
      return JSON.stringify(scanner(scopedFiles));
    },
    {
      name: "semgrep_scan",
      description:
        "Run static security analysis (semgrep rules) over the changed files in the pull request.",
      schema: z.object({
        paths: z
          .array(z.string())
          .optional()
          .describe(
            "Restrict the scan to these file paths; omit to scan all changed files.",
          ),
      }),
    },
  );
