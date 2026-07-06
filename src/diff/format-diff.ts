import type { DiffFile, DiffLine } from "./types";

const MARKERS: Record<DiffLine["kind"], string> = {
  added: "+",
  removed: "-",
  context: " ",
};

const formatLine = (line: DiffLine): string => {
  const lineNumber = line.newLineNumber ?? line.oldLineNumber ?? 0;
  return `${String(lineNumber).padStart(4)} ${MARKERS[line.kind]} ${line.content}`;
};

/** Renders a parsed file with line numbers so the model can anchor findings to real lines. */
export const formatFileForPrompt = (file: DiffFile): string => {
  const hunks = file.hunks.map((hunk) =>
    [`@@ ${hunk.header}`.trim(), ...hunk.lines.map(formatLine)].join("\n"),
  );
  return [`File: ${file.path} (${file.status})`, ...hunks].join("\n");
};

export const formatFilesForPrompt = (files: DiffFile[]): string =>
  files.map(formatFileForPrompt).join("\n\n");

/** Compact one-line-per-file summary used for retrieval queries and docs impact. */
export const summarizeFiles = (files: DiffFile[]): string =>
  files
    .map((file) => {
      const addedLines = file.hunks.flatMap((hunk) =>
        hunk.lines.filter((line) => line.kind === "added"),
      );
      return `${file.path} (${file.status}, +${addedLines.length} lines)`;
    })
    .join("\n");
