// Private check: download the whole public boundary index once and score in the browser with the
// same mirage-core code the server uses. The amount being checked never leaves this device.
import { assess } from '../../../packages/core/src/score';
import type { BoundaryIndex } from '../../../packages/core/src/types';
import { api, type Assessment } from './api';

const EXPLORER = 'https://testnet.zecblock.com/tx/';
let cache: { at: number; index: BoundaryIndex } | undefined;

async function publicIndex(): Promise<BoundaryIndex> {
  if (cache && Date.now() - cache.at < 120_000) return cache.index;
  const index = await api.index();
  cache = { at: Date.now(), index };
  return index;
}

export async function checkPrivately(amount: string): Promise<Assessment & { indexed: number }> {
  const index = await publicIndex();
  const a = assess(index, { zats: Math.round(Number(amount) * 1e8), time: Math.floor(Date.now() / 1000) });
  return {
    level: a.level,
    crowd: a.crowd,
    reason: a.reason,
    candidates: a.candidates.map((c) => ({ txid: c.txid, time: c.time, zats: c.zats ?? 0, explorer: EXPLORER + c.txid })),
    indexed: index.crossings.length,
  };
}
