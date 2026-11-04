import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { BoundaryIndex, Crossing } from 'mirage-core';
import { config } from './config.js';
import { txidHex, type CompactBlock, type CompactTx, type LwdClient } from './lightwalletd.js';

const INDEX_FILE = () => join(config.dataDir, 'index.json');

interface Pending {
  txid: string;
  height: number;
  time: number;
  pools: Crossing['pools'];
  vin: [string, number][];
  tOut: number;
}

const shieldedParts = (tx: CompactTx) => ({
  sapling: tx.spends.length + tx.outputs.length,
  orchard: tx.actions.length,
  ironwood: tx.ironwoodActions.length,
});

/**
 * Classify one transaction as a boundary crossing, or null.
 * - Deshield: shielded parts, no transparent inputs, transparent outputs > 0. Value = sum(vout).
 * - Shield: transparent inputs and shielded parts. Value = sum(prevout values) - sum(vout).
 *   The server doesn't report fees, so a shield's value includes the fee; scoring uses a tolerance.
 */
export function classify(tx: CompactTx, height: number, time: number): Crossing | Pending | null {
  if (Number(tx.index) === 0) return null; // coinbase
  const pools = shieldedParts(tx);
  if (pools.sapling + pools.orchard + pools.ironwood === 0) return null; // purely transparent
  const tOut = tx.vout.reduce((a, o) => a + Number(o.value), 0);
  const txid = txidHex(tx.txid);
  if (tx.vin.length === 0) {
    return tOut > 0 ? { txid, height, time, direction: 'deshield', zats: tOut, pools } : null; // tOut 0 = fully shielded
  }
  return { txid, height, time, pools, tOut, vin: tx.vin.map((i) => [txidHex(i.prevoutTxid), i.prevoutIndex]) };
}

export class Indexer {
  index: BoundaryIndex = { network: 'test', fromHeight: 0, toHeight: 0, generatedAt: 0, crossings: [] };
  /** txid -> transparent output values, for resolving shield inputs. Bounded to recent blocks. */
  private vouts = new Map<string, number[]>();
  private running = false;

  constructor(private lwd: LwdClient) {}

  async load() {
    try {
      this.index = JSON.parse(await readFile(INDEX_FILE(), 'utf8'));
    } catch {
      /* first run */
    }
  }

  private async save() {
    await mkdir(config.dataDir, { recursive: true });
    const tmp = INDEX_FILE() + '.tmp';
    await writeFile(tmp, JSON.stringify(this.index));
    await rename(tmp, INDEX_FILE());
  }

  /** Look up a transparent output value, fetching the funding transaction's block if it's older than the scan. */
  private async prevoutValue(txid: string, n: number): Promise<number | null> {
    let outs = this.vouts.get(txid);
    if (!outs) {
      try {
        const h = await this.lwd.txHeight(txid);
        const b = await this.lwd.block(h);
        const tx = b.vtx.find((t) => txidHex(t.txid) === txid);
        if (!tx) return null;
        outs = tx.vout.map((o) => Number(o.value));
        this.vouts.set(txid, outs);
      } catch {
        return null;
      }
    }
    return outs[n] ?? null;
  }

  /** Scan [start, end] and append crossings. */
  async scan(start: number, end: number) {
    const pending: Pending[] = [];
    const found: Crossing[] = [];
    await this.lwd.blockRange(start, end, (b: CompactBlock) => {
      const h = Number(b.height);
      for (const tx of b.vtx) {
        this.vouts.set(txidHex(tx.txid), tx.vout.map((o) => Number(o.value)));
        const r = classify(tx, h, b.time);
        if (!r) continue;
        if ('direction' in r) found.push(r);
        else pending.push(r);
      }
    });
    for (const p of pending) {
      let tIn = 0;
      let known = true;
      for (const [id, n] of p.vin) {
        const v = await this.prevoutValue(id, n);
        if (v === null) known = false;
        else tIn += v;
      }
      const zats = known ? tIn - p.tOut : null;
      if (zats !== null && zats <= 0) continue; // net value moved out to transparent: not a shield
      found.push({ txid: p.txid, height: p.height, time: p.time, direction: 'shield', zats, pools: p.pools });
    }
    found.sort((a, b) => a.height - b.height);
    const seen = new Set(this.index.crossings.map((c) => c.txid));
    this.index.crossings.push(...found.filter((c) => !seen.has(c.txid)));
    if (!this.index.fromHeight) this.index.fromHeight = start;
    this.index.toHeight = end;
    this.index.generatedAt = Math.floor(Date.now() / 1000);
    if (this.vouts.size > 200_000) this.vouts.clear();
    await this.save();
    return found.length;
  }

  /** Catch up to the chain tip, in chunks. */
  async sync(log = console.log) {
    if (this.running) return;
    this.running = true;
    try {
      // Stay one block behind the reported tip: some servers announce a block before they can serve it.
      const tip = (await this.lwd.latestHeight()) - 1;
      let from = this.index.toHeight ? this.index.toHeight + 1 : Math.max(1, tip - config.backfillBlocks + 1);
      while (from <= tip) {
        const to = Math.min(tip, from + 4999);
        const n = await this.scan(from, to);
        log(`indexed ${from}..${to}: +${n} crossings (total ${this.index.crossings.length})`);
        from = to + 1;
      }
    } finally {
      this.running = false;
    }
  }
}
