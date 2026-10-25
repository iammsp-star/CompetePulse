import type { TargetType } from '../../shared/types';

export interface ChunkInput {
  id: string;
  snapshotId: string;
  competitorId: string;
  targetId: string;
  section: string;
  text: string;
  chunkIndex: number;
  embedding: Float32Array;
  dim: number;
  model: string;
}

export interface ScrapePage {
  title: string;
  markdown: string;
  screenshotUrl: string | null;
  mode: 'live' | 'simulated' | 'seed';
  provider: string;
  wordCount: number;
}

export interface TargetDescriptor {
  id: string;
  competitorId: string;
  type: TargetType;
  url: string;
}
