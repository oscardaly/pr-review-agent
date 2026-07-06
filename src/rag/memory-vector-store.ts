import type { DocumentInterface } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";

type StoredVector = { vector: number[]; document: DocumentInterface };

const cosineSimilarity = (left: number[], right: number[]): number => {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }
  return (
    dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude) || 1)
  );
};

/**
 * Minimal in-memory vector store (LangChain v1 dropped the bundled one).
 * Cosine similarity over embedded chunks — plenty for a mini knowledge base.
 */
export class MemoryVectorStore extends VectorStore {
  declare FilterType: (document: DocumentInterface) => boolean;

  private stored: StoredVector[] = [];

  _vectorstoreType(): string {
    return "in-memory";
  }

  async addDocuments(documents: DocumentInterface[]): Promise<void> {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((document) => document.pageContent),
    );
    await this.addVectors(vectors, documents);
  }

  async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
  ): Promise<void> {
    for (let index = 0; index < vectors.length; index += 1) {
      this.stored.push({
        vector: vectors[index]!,
        document: documents[index]!,
      });
    }
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"],
  ): Promise<[DocumentInterface, number][]> {
    return this.stored
      .filter(({ document }) => filter?.(document) ?? true)
      .map(({ vector, document }): [DocumentInterface, number] => [
        document,
        cosineSimilarity(query, vector),
      ])
      .sort(([, leftScore], [, rightScore]) => rightScore - leftScore)
      .slice(0, k);
  }

  static async fromDocuments(
    documents: DocumentInterface[],
    embeddings: EmbeddingsInterface,
  ): Promise<MemoryVectorStore> {
    const store = new MemoryVectorStore(embeddings, {});
    await store.addDocuments(documents);
    return store;
  }
}
