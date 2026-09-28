import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getEnv } from "./env";

// Embeddings are only used as a cheap pre-filter (cosine similarity) before
// the LLM does the real scoring/explanation work in src/agents/match.ts.
// Kept on a separate provider knob from LLM_PROVIDER since embedding model
// availability differs (e.g. Anthropic has no embeddings endpoint).
function getEmbeddingModel() {
  const env = getEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (required for EMBEDDING_PROVIDER=openai).");
  }
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai.textEmbeddingModel(env.EMBEDDING_MODEL);
}

export async function embedOne(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: getEmbeddingModel(), value: text.slice(0, 8000) });
  return embedding;
}

// OpenAI caps one embeddings request at 2048 inputs / ~300k tokens; a fresh
// company board can hand us 100+ long postings at once, so chunk well below that.
const EMBED_CHUNK_SIZE = 48;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = getEmbeddingModel();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_CHUNK_SIZE) {
    const { embeddings } = await embedMany({
      model,
      values: texts.slice(i, i + EMBED_CHUNK_SIZE).map((t) => t.slice(0, 8000)),
    });
    out.push(...embeddings);
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
