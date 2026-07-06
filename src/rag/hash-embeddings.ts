import { Embeddings } from "@langchain/core/embeddings";

const DIMENSIONS = 512;

const tokenize = (text: string): string[] =>
  text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];

/** FNV-1a — stable across runs, no dependencies. */
const hashToken = (token: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % DIMENSIONS;
};

const embedText = (text: string): number[] => {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const token of tokenize(text)) {
    const dimension = hashToken(token);
    vector[dimension] = (vector[dimension] ?? 0) + 1;
  }
  const magnitude =
    Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
};

/**
 * Deterministic bag-of-words embeddings (hashing trick). Zero network calls, so
 * the demo, tests, and Docker image work offline. Retrieval quality is keyword
 * overlap — good enough for a small curated knowledge base; swap in a real
 * embedding model via OPENAI_API_KEY for semantic matching.
 */
export class HashEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  embedDocuments = async (texts: string[]): Promise<number[][]> =>
    texts.map(embedText);

  embedQuery = async (text: string): Promise<number[]> => embedText(text);
}
