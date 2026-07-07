import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { DiffFile } from "../diff/types";

export type SourceFileMapping = {
  path: string;
  status: DiffFile["status"];
  addedLines: number;
  /** True when a test file sharing this file's basename was touched in the same PR. */
  testTouched: boolean;
};

export type TestMappingReport = {
  sourceFiles: SourceFileMapping[];
  testFilesChanged: string[];
};

const CODE_EXTENSION = /\.[cm]?[jt]sx?$/;

const isTestFile = (path: string): boolean =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
  /(^|\/)(__tests__|tests?)\//.test(path);

const isSourceFile = (path: string): boolean =>
  CODE_EXTENSION.test(path) && !isTestFile(path);

/** `src/lib/upload.ts` → `upload`; `upload.test.ts` → `upload`. */
const stemOf = (path: string): string =>
  path.split("/").pop()!.replace(/\.(test|spec)(?=\.)/, "").replace(CODE_EXTENSION, "");

const countAddedLines = (file: DiffFile): number =>
  file.hunks.flatMap((hunk) => hunk.lines).filter((line) => line.kind === "added")
    .length;

/**
 * Deterministic ground truth for the tests reviewer: which changed source
 * files had no matching test file touched in the same PR. Diff-only on
 * purpose — "logic changed, no test changed" is the reviewable signal.
 */
export const analyzeTestMapping = (files: DiffFile[]): TestMappingReport => {
  const testFilesChanged = files
    .map((file) => file.path)
    .filter(isTestFile);
  const testStems = new Set(testFilesChanged.map(stemOf));

  return {
    sourceFiles: files
      .filter((file) => isSourceFile(file.path) && file.status !== "deleted")
      .map((file) => ({
        path: file.path,
        status: file.status,
        addedLines: countAddedLines(file),
        testTouched: testStems.has(stemOf(file.path)),
      })),
    testFilesChanged,
  };
};

/** Wraps the analyzer as a LangChain tool so every mapping is a traced tool run in LangSmith. */
export const createTestMappingTool = (files: DiffFile[]) =>
  tool(async (): Promise<string> => JSON.stringify(analyzeTestMapping(files)), {
    name: "test_mapping",
    description:
      "Map the changed source files in the pull request to the test files touched alongside them.",
    schema: z.object({}),
  });
