import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const SAMPLE_FILE_LIMIT = 12;
const SAMPLE_CHARS_PER_FILE = 4000;
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const GENERATION_PROMPTS = {
  "code-style.md":
    "a code style guide: naming, function shape, typing, formatting habits you can observe",
  "clean-architecture.md":
    "an architecture guide: module boundaries, layering, how dependencies are wrapped",
} as const;

const collectSourceFiles = async (
  directory: string,
  collected: string[],
): Promise<void> => {
  if (collected.length >= SAMPLE_FILE_LIMIT) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (collected.length >= SAMPLE_FILE_LIMIT) return;
    if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) {
      await collectSourceFiles(join(directory, entry.name), collected);
    } else if (
      SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
    ) {
      collected.push(join(directory, entry.name));
    }
  }
};

const readSamples = async (repoPath: string): Promise<string> => {
  const files: string[] = [];
  await collectSourceFiles(repoPath, files);
  const samples = await Promise.all(
    files.map(
      async (path) =>
        `--- ${path} ---\n${(await readFile(path, "utf-8")).slice(0, SAMPLE_CHARS_PER_FILE)}`,
    ),
  );
  return samples.join("\n\n");
};

/**
 * "Write the guideline docs for yourself": samples the target repository and
 * drafts the knowledge-base documents the reviewers will retrieve against.
 * Output is meant to be human-edited before it becomes team law.
 */
export const bootstrapKnowledge = async (
  repoPath: string,
  knowledgePath: string,
  model: BaseChatModel,
): Promise<string[]> => {
  const samples = await readSamples(repoPath);
  const writtenFiles: string[] = [];
  for (const [filename, description] of Object.entries(GENERATION_PROMPTS)) {
    const response = await model.invoke([
      new SystemMessage(
        `You are documenting the ACTUAL conventions of a codebase from samples, writing ${description}. ` +
          "Output markdown where every rule is a `##` section (the review agent retrieves sections individually). " +
          "Describe only patterns you can evidence in the samples; 6-10 rules, each 2-4 sentences.",
      ),
      new HumanMessage(samples),
    ]);
    const outputPath = join(knowledgePath, filename);
    await writeFile(outputPath, String(response.content));
    writtenFiles.push(outputPath);
  }
  return writtenFiles;
};
