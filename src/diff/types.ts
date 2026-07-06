export type DiffLineKind = "added" | "removed" | "context";

export type DiffLine = {
  kind: DiffLineKind;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type DiffFileStatus = "added" | "deleted" | "modified";

export type DiffFile = {
  path: string;
  status: DiffFileStatus;
  hunks: DiffHunk[];
};

export type PullRequestMetadata = {
  number: number;
  title: string;
  description: string;
  author: string;
  repository: string;
};

export type PullRequest = PullRequestMetadata & {
  files: DiffFile[];
};
