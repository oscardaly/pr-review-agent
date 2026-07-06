import type { DiffFile, DiffHunk, DiffLine } from "./types";

const FILE_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

const lineKindOf = (line: string): DiffLine["kind"] | undefined => {
  if (line.startsWith("+")) return "added";
  if (line.startsWith("-")) return "removed";
  if (line.startsWith(" ") || line === "") return "context";
  return undefined;
};

const statusOf = (rawFileBlock: string[]): DiffFile["status"] => {
  if (rawFileBlock.some((line) => line.startsWith("new file mode")))
    return "added";
  if (rawFileBlock.some((line) => line.startsWith("deleted file mode")))
    return "deleted";
  return "modified";
};

export const parseUnifiedDiff = (diff: string): DiffFile[] => {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | undefined;
  let currentHunk: DiffHunk | undefined;
  let headerLines: string[] = [];
  let oldLineNumber = 0;
  let newLineNumber = 0;

  const diffLines = diff.split("\n");
  while (diffLines.at(-1) === "") diffLines.pop();

  for (const line of diffLines) {
    const fileMatch = line.match(FILE_HEADER);
    if (fileMatch) {
      currentFile = { path: fileMatch[2]!, status: "modified", hunks: [] };
      files.push(currentFile);
      currentHunk = undefined;
      headerLines = [];
      continue;
    }
    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch && currentFile) {
      currentFile.status = statusOf(headerLines);
      oldLineNumber = Number(hunkMatch[1]);
      newLineNumber = Number(hunkMatch[2]);
      currentHunk = { header: hunkMatch[3]!.trim(), lines: [] };
      currentFile.hunks.push(currentHunk);
      continue;
    }
    if (!currentHunk) {
      headerLines.push(line);
      continue;
    }
    const kind = lineKindOf(line);
    if (!kind) continue;
    currentHunk.lines.push(buildLine(kind, line, oldLineNumber, newLineNumber));
    if (kind !== "added") oldLineNumber += 1;
    if (kind !== "removed") newLineNumber += 1;
  }
  return files;
};

const buildLine = (
  kind: DiffLine["kind"],
  rawLine: string,
  oldLineNumber: number,
  newLineNumber: number,
): DiffLine => ({
  kind,
  content: rawLine.slice(1),
  ...(kind !== "added" && { oldLineNumber }),
  ...(kind !== "removed" && { newLineNumber }),
});
