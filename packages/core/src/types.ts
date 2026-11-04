/** Direction of value crossing the shielded-pool boundary. */
export type Direction = 'shield' | 'deshield';

/** One public boundary crossing observed on-chain. Amounts are in zatoshis (1 ZEC = 100_000_000). */
export interface Crossing {
  txid: string;
  height: number;
  /** Block time, Unix seconds. */
  time: number;
  direction: Direction;
  /** Value that crossed the boundary, or null if it couldn't be computed (e.g. unknown prevout). */
  zats: number | null;
  /** Shielded components seen in the transaction, by pool. */
  pools: { sapling: number; orchard: number; ironwood: number };
}

/** The public boundary index the client downloads and scores against locally. */
export interface BoundaryIndex {
  network: 'test' | 'main';
  fromHeight: number;
  toHeight: number;
  /** Unix seconds. */
  generatedAt: number;
  crossings: Crossing[];
}

/** A planned or hypothetical exit from the shielded pool. */
export interface ExitIntent {
  zats: number;
  /** When the exit would be broadcast, Unix seconds. */
  time: number;
}

export type RiskLevel = 'red' | 'amber' | 'green';
