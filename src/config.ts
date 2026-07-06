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

export const loadConfig = (
  env: NodeJS.ProcessEnv = process.env,
): AgentConfig => ({
  model: env.PR_AGENT_MODEL ?? "gpt-4o-mini",
  openaiApiKey: env.OPENAI_API_KEY,
  openaiBaseUrl: env.OPENAI_BASE_URL,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  knowledgePath: env.PR_AGENT_KNOWLEDGE_PATH ?? `${AGENT_ROOT}knowledge`,
  userDocsPath:
    env.PR_AGENT_USER_DOCS_PATH ?? `${AGENT_ROOT}fixtures/user-docs`,
  outputPath: env.PR_AGENT_OUTPUT_PATH ?? `${AGENT_ROOT}review-output`,
  validationConfidenceThreshold: Number(
    env.PR_AGENT_VALIDATION_THRESHOLD ?? "0.6",
  ),
});
