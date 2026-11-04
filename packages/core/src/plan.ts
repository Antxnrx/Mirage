import type { BoundaryIndex } from './types.js';

/** Fallback denominations (zats) when the index has too little data: 1, 0.5, 0.25, 0.1, 0.05, 0.01, 0.005, 0.001 ZEC. */
export const DEFAULT_DENOMINATIONS = [100_000_000, 50_000_000, 25_000_000, 10_000_000, 5_000_000, 1_000_000, 500_000, 100_000];

/**
 * Amounts that commonly cross the boundary, most frequent first, merged with the defaults.
 * Amounts are rounded to `roundTo` zats before counting, so near-identical values group together.
 */
export function commonDenominations(index: BoundaryIndex, { top = 6, roundTo = 100_000 } = {}): number[] {
  const counts = new Map<number, number>();
  for (const c of index.crossings) {
    if (c.zats === null || c.zats < roundTo) continue;
    const r = Math.round(c.zats / roundTo) * roundTo;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const frequent = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([v]) => v);
  return [...new Set([...frequent, ...DEFAULT_DENOMINATIONS])].sort((a, b) => b - a);
}

export interface PlanOptions {
  denominations?: number[];
  /** Mean gap between pieces, seconds. Default 3 hours. */
  meanDelaySecs?: number;
  maxPieces?: number;
  /** Start time, Unix seconds. */
  now?: number;
  /** Random source in [0, 1). Injected for tests. */
  rng?: () => number;
}

export interface PlannedPiece {
  zats: number;
  /** Suggested broadcast time, Unix seconds. */
  at: number;
}

export interface ExitPlan {
  pieces: PlannedPiece[];
  /** Value left in the shielded pool because it doesn't fit a common denomination. */
  remainderZats: number;
}

/**
 * Split an exit into common denominations sent at randomized times.
 * Whatever doesn't fit a denomination stays shielded rather than leaving as a unique amount.
 */
export function planExit(zats: number, opts: PlanOptions = {}): ExitPlan {
  const denoms = [...(opts.denominations ?? DEFAULT_DENOMINATIONS)].sort((a, b) => b - a);
  const maxPieces = opts.maxPieces ?? 6;
  const mean = opts.meanDelaySecs ?? 3 * 3600;
  const rng = opts.rng ?? Math.random;
  let t = opts.now ?? Math.floor(Date.now() / 1000);

  const amounts: number[] = [];
  let remaining = zats;
  for (const d of denoms) {
    while (remaining >= d && amounts.length < maxPieces) {
      amounts.push(d);
      remaining -= d;
    }
  }
  // Shuffle so piece order doesn't reveal the split.
  for (let i = amounts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [amounts[i], amounts[j]] = [amounts[j], amounts[i]];
  }
  const pieces = amounts.map((a) => {
    t += Math.max(60, Math.round(-Math.log(1 - rng()) * mean)); // exponential gaps, at least a minute
    return { zats: a, at: t };
  });
  return { pieces, remainderZats: remaining };
}
