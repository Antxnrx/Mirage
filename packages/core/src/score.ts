import type { BoundaryIndex, Crossing, ExitIntent, RiskLevel } from './types.js';

export interface ScoreOptions {
  /** How far back to look for matching crossings. Default 7 days (testnet traffic is low). */
  windowSecs?: number;
  /** Absolute amount tolerance. Default 20_000 zats, which covers ZIP 317 fees on small transactions. */
  toleranceZats?: number;
  /** Relative amount tolerance, applied when larger than the absolute one. Default 0.5%. */
  tolerancePct?: number;
  /** Crowd size at or above which an exit is considered blended. Default 10. */
  greenCrowd?: number;
}

const DEFAULTS: Required<ScoreOptions> = {
  windowSecs: 7 * 24 * 3600,
  toleranceZats: 20_000,
  tolerancePct: 0.005,
  greenCrowd: 10,
};

export function amountsMatch(a: number, b: number, opts: ScoreOptions = {}): boolean {
  const o = { ...DEFAULTS, ...opts };
  const tol = Math.max(o.toleranceZats, Math.round(Math.max(a, b) * o.tolerancePct));
  return Math.abs(a - b) <= tol;
}

const inWindow = (c: Crossing, exit: ExitIntent, windowSecs: number) =>
  c.time <= exit.time && c.time >= exit.time - windowSecs;

/** Entries into the shielded pool that an observer could pair with this exit by amount and timing. */
export function linkCandidates(index: BoundaryIndex, exit: ExitIntent, opts: ScoreOptions = {}): Crossing[] {
  const o = { ...DEFAULTS, ...opts };
  return index.crossings.filter(
    (c) => c.direction === 'shield' && c.zats !== null && inWindow(c, exit, o.windowSecs) && amountsMatch(c.zats, exit.zats, o),
  );
}

/**
 * How many crossings (either direction) in the window look like this exit.
 * The exit itself would join this crowd, so a value of 0 means it would stand alone.
 */
export function crowdFor(index: BoundaryIndex, exit: ExitIntent, opts: ScoreOptions = {}): number {
  const o = { ...DEFAULTS, ...opts };
  return index.crossings.filter((c) => c.zats !== null && inWindow(c, exit, o.windowSecs) && amountsMatch(c.zats, exit.zats, o)).length;
}

export interface Assessment {
  level: RiskLevel;
  /** Entries an observer could pair with this exit. */
  candidates: Crossing[];
  /** Crossings that look like this exit (excluding the exit itself). */
  crowd: number;
  reason: string;
}

/** Score a planned exit against the public boundary index. */
export function assess(index: BoundaryIndex, exit: ExitIntent, opts: ScoreOptions = {}): Assessment {
  const o = { ...DEFAULTS, ...opts };
  const candidates = linkCandidates(index, exit, o);
  const crowd = crowdFor(index, exit, o);
  if (candidates.length === 1) {
    return { level: 'red', candidates, crowd, reason: 'Exactly one recent entry matches this amount, so an observer can pair them.' };
  }
  if (crowd === 0) {
    return { level: 'red', candidates, crowd, reason: 'No other recent crossing has this amount, so this exit stands out.' };
  }
  if (crowd < o.greenCrowd) {
    return { level: 'amber', candidates, crowd, reason: `Only ${crowd} recent crossing(s) look like this one.` };
  }
  return { level: 'green', candidates, crowd, reason: `${crowd} recent crossings look like this one.` };
}
