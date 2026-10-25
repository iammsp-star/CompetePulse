import crypto from 'node:crypto';
import type { SearchResult, TargetType } from '../../shared/types';
import { dbh } from '../db';
import { fromBuffer, toBuffer } from './embeddings';
import type { ChunkInput } from './types';

const QDRANT_URL = process.env.QDRANT_URL?.replace(/\/$/, '');
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION = process.env.QDRANT_COLLECTION ?? 'competepulse';
let qdrantCollectionReady = false;
let qdrantWarned = false;

export function vectorStoreStatus() {
  if (!QDRANT_URL) return { provider: 'sqlite', live: false, detail: 'Local SQLite vector index (set QDRANT_URL to mirror)' };
  return {
    provider: 'qdrant',
    live: true,
    detail: `${QDRANT_URL} · collection "${COLLECTION}" (mirrored locally for fallback)`,
  };
}

async function qdrant(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${QDRANT_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
}

async function ensureQdrantCollection(dim: number) {
  if (!QDRANT_URL || qdrantCollectionReady) return;
  const existing = await qdrant(`/collections/${COLLECTION}`);
  if (existing.status === 404) {
    const created = await qdrant(`/collections/${COLLECTION}`, {
      method: 'PUT',
      body: JSON.stringify({ vectors: { size: dim, distance: 'Cosine' } }),
    });
    if (!created.ok && created.status !== 409) throw new Error(`Qdrant create failed: ${created.status}`);
  } else if (!existing.ok) {
    throw new Error(`Qdrant collection check failed: ${existing.status}`);
  }
  qdrantCollectionReady = true;
}

async function mirrorToQdrant(chunks: ChunkInput[]) {
  if (!QDRANT_URL || !chunks.length) return;
  try {
    await ensureQdrantCollection(chunks[0].dim);
    const response = await qdrant(`/collections/${COLLECTION}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: chunks.map((chunk) => ({
          id: chunk.id,
          vector: Array.from(chunk.embedding),
          payload: {
            competitorId: chunk.competitorId,
            targetId: chunk.targetId,
            snapshotId: chunk.snapshotId,
            section: chunk.section,
            text: chunk.text.slice(0, 2000),
          },
        })),
      }),
    });
    if (!response.ok) throw new Error(`upsert ${response.status}`);
  } catch (error) {
    if (!qdrantWarned) console.warn('[vectors] Qdrant mirror unavailable, using local index:', (error as Error).message);
    qdrantWarned = true;
  }
}

export async function upsertChunks(chunks: ChunkInput[]): Promise<void> {
  for (const chunk of chunks) {
    dbh.run(
      `INSERT OR REPLACE INTO chunks (id, snapshot_id, competitor_id, target_id, section, text, chunk_index, embedding, dim, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      chunk.id,
      chunk.snapshotId,
      chunk.competitorId,
      chunk.targetId,
      chunk.section,
      chunk.text,
      chunk.chunkIndex,
      toBuffer(chunk.embedding) as unknown as string,
      chunk.dim,
      chunk.model,
      new Date().toISOString(),
    );
  }
  await mirrorToQdrant(chunks);
}

export function newChunkId(): string {
  return crypto.randomUUID();
}

type ChunkRow = {
  id: string;
  snapshot_id: string;
  competitor_id: string;
  target_id: string;
  section: string;
  text: string;
  chunk_index: number;
  embedding: Uint8Array;
  dim: number;
  model: string;
  competitor_name: string;
  competitor_color: string;
  target_type: string;
  captured_at: string;
};

const SEARCH_SELECT = `
  SELECT ch.*, c.name AS competitor_name, c.color AS competitor_color,
         t.type AS target_type, s.captured_at
  FROM chunks ch
  JOIN competitors c ON c.id = ch.competitor_id
  JOIN targets t ON t.id = ch.target_id
  JOIN snapshots s ON s.id = ch.snapshot_id
`;

function rowToResult(row: ChunkRow, score: number): SearchResult {
  return {
    chunkId: row.id,
    snapshotId: row.snapshot_id,
    competitorId: row.competitor_id,
    competitorName: row.competitor_name,
    competitorColor: row.competitor_color,
    targetType: row.target_type as TargetType,
    capturedAt: row.captured_at,
    section: row.section,
    text: row.text,
    score,
  };
}

function latestClause() {
  return 'AND s.captured_at = (SELECT MAX(s2.captured_at) FROM snapshots s2 WHERE s2.target_id = ch.target_id)';
}

function keywordScore(query: string | undefined, text: string): number {
  if (!query) return 0;
  const tokens = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !['the', 'and', 'for', 'how', 'what', 'does', 'with', 'its', 'are', 'our'].includes(token)),
  );
  if (!tokens.size) return 0;
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const token of tokens) if (haystack.includes(token)) hits++;
  const phraseBoost = haystack.includes(query.toLowerCase().trim()) ? 0.25 : 0;
  return Math.min(1, hits / tokens.size + phraseBoost);
}

export async function searchChunks(
  queryVector: Float32Array,
  options: { competitorId?: string; limit?: number; queryText?: string } = {},
): Promise<SearchResult[]> {
  const limit = options.limit ?? 8;
  const params: string[] = [];
  let sql = `${SEARCH_SELECT} WHERE 1=1 ${latestClause()}`;
  if (options.competitorId) {
    sql += ' AND ch.competitor_id = ?';
    params.push(options.competitorId);
  }
  const rows = dbh.all<ChunkRow>(sql, ...params);
  const scored = rows
    .map((row) => {
      const vec = fromBuffer(row.embedding);
      let dot = 0;
      if (vec.length === queryVector.length) {
        for (let i = 0; i < vec.length; i++) dot += vec[i] * queryVector[i];
      }
      const lexical = keywordScore(options.queryText, `${row.section} ${row.text}`);
      const query = options.queryText?.toLowerCase() ?? '';
      const sectionMatch = row.section
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((token) => token.length > 3 && query.includes(token))
        ? 0.35
        : 0;
      const pricingBoost = /price|pricing|tier|plan|cost|\$/.test(query) && /[$€£]\s?\d/.test(row.text) ? 0.25 : 0;
      // A plan/feature heading that the question names explicitly is a strong relevance signal.
      const planBoost =
        /[$€£]\s?\d/.test(row.text) &&
        row.section
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .some((token) => token.length > 3 && query.includes(token))
          ? 0.55
          : 0;
      return { row, score: Math.min(1, dot + lexical * 0.55 + sectionMatch + pricingBoost + planBoost) };
    })
    .filter((r) => r.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => rowToResult(r.row, Number(r.score.toFixed(4))));

  if (!QDRANT_URL) return scored;
  try {
    await ensureQdrantCollection(queryVector.length);
    const response = await qdrant(`/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      body: JSON.stringify({
        vector: Array.from(queryVector),
        limit,
        with_payload: true,
        ...(options.competitorId
          ? { filter: { must: [{ key: 'competitorId', match: { value: options.competitorId } }] } }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(`search ${response.status}`);
    const data = (await response.json()) as { result: { id: string; score: number }[] };
    const ids = data.result.map((r) => String(r.id));
    if (!ids.length) return scored;
    const placeholders = ids.map(() => '?').join(',');
    const localRows = dbh.all<ChunkRow>(`${SEARCH_SELECT} WHERE ch.id IN (${placeholders})`, ...ids);
    const byId = new Map(localRows.map((r) => [r.id, r]));
    const qdrantResults = data.result
      .map((hit) => {
        const row = byId.get(String(hit.id));
        return row ? rowToResult(row, Number(hit.score.toFixed(4))) : null;
      })
      .filter((r): r is SearchResult => Boolean(r));
    return qdrantResults.length ? qdrantResults : scored;
  } catch (error) {
    if (!qdrantWarned) console.warn('[vectors] Qdrant search failed, using local index:', (error as Error).message);
    qdrantWarned = true;
    return scored;
  }
}

export function chunkCount(): number {
  return Number(dbh.one<{ n: number }>('SELECT COUNT(*) AS n FROM chunks')?.n ?? 0);
}
