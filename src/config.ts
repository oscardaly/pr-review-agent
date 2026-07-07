const AGENT_ROOT = new URL("..", import.meta.url).pathname;

export type AgentConfig = {
  model: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  anthropicApiKey?: string;
  knowledgePath: string;
  userDocsPath: string;
  outputPath: string;
  validationConfidenceThreshold: number;
};

/** The default must match the key that selects the provider — an Anthropic key with a GPT model id would 404 mid-review. */
const defaultModelFor = (env: NodeJS.ProcessEnv): string =>
  !env.OPENAI_API_KEY && env.ANTHROPIC_API_KEY
    ? "claude-sonnet-4-5"
    : "gpt-4o-mini";

const parseThreshold = (raw: string): number => {
  const threshold = Number(raw);
  if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(
      `PR_AGENT_VALIDATION_THRESHOLD must be a number between 0 and 1, got "${raw}"`,
    );
  }
  return threshold;
};

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
): AgentConfig => ({
  model: env.PR_AGENT_MODEL ?? defaultModelFor(env),
  openaiApiKey: env.OPENAI_API_KEY,
  openaiBaseUrl: env.OPENAI_BASE_URL,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  knowledgePath: env.PR_AGENT_KNOWLEDGE_PATH ?? `${AGENT_ROOT}knowledge`,
  userDocsPath:
    env.PR_AGENT_USER_DOCS_PATH ?? `${AGENT_ROOT}fixtures/user-docs`,
  outputPath: env.PR_AGENT_OUTPUT_PATH ?? `${AGENT_ROOT}review-output`,
  validationConfidenceThreshold: parseThreshold(
    env.PR_AGENT_VALIDATION_THRESHOLD ?? "0.6",
  ),
});
