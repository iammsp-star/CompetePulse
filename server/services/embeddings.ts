import { stripMarkdown } from '../lib/util';

export const LOCAL_DIM = 384;
export const OPENAI_DIM = 1536;

export interface EmbeddingResult {
  vectors: Float32Array[];
  model: string;
  dim: number;
  provider: 'openai' | 'local';
}

export function embeddingsProvider() {
  return process.env.OPENAI_API_KEY
    ? { provider: 'openai' as const, model: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small', dim: OPENAI_DIM }
    : { provider: 'local' as const, model: 'local-hash-v1', dim: LOCAL_DIM };
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Feature hashing over words and word bigrams. Purely local, deterministic and
 * good enough for lexical similarity demos when no embedding key is configured.
 */
export function localEmbedding(text: string, dim = LOCAL_DIM): Float32Array {
  const vector = new Float32Array(dim);
  const clean = stripMarkdown(text).toLowerCase();
  const words = clean.split(/[^a-z0-9$%.]+/).filter((w) => w.length > 1);
  const add = (token: string, weight: number) => {
    const hash = fnv1a(token);
    const idx = hash % dim;
    const sign = (hash & 0x80000000) !== 0 ? -1 : 1;
    vector[idx] += weight * sign;
  };
  for (let i = 0; i < words.length; i++) {
    add(words[i], 1);
    if (i > 0) add(`${words[i - 1]}_${words[i]}`, 0.55);
    if (words[i].length > 6) {
      const w = words[i];
      for (let k = 0; k <= w.length - 3; k++) add(`#${w.slice(k, k + 3)}`, 0.08);
    }
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vector[i] /= norm;
  return vector;
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
  const config = embeddingsProvider();
  if (config.provider === 'local') {
    return { vectors: texts.map((t) => localEmbedding(t, LOCAL_DIM)), model: config.model, dim: LOCAL_DIM, provider: 'local' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: config.model, input: texts.map((t) => t.slice(0, 8000)) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`OpenAI embeddings ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const data = (await response.json()) as { data: { embedding: number[]; index: number }[] };
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    return {
      vectors: ordered.map((d) => Float32Array.from(d.embedding)),
      model: config.model,
      dim: ordered[0]?.embedding.length ?? config.dim,
      provider: 'openai',
    };
  } catch (error) {
    console.warn('[embeddings] OpenAI failed, using local hash embeddings:', (error as Error).message);
    return { vectors: texts.map((t) => localEmbedding(t, LOCAL_DIM)), model: 'local-hash-v1', dim: LOCAL_DIM, provider: 'local' };
  }
}

export function cosine(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

export function toBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function fromBuffer(buffer: Uint8Array): Float32Array {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return new Float32Array(copy.buffer);
}
