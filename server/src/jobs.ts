import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assess, toZats, type Assessment, type BoundaryIndex } from 'mirage-core';
import { config } from './config.js';
import { wallet } from './zkool.js';

/**
 * A guarded exit: funds are first split inside the shielded pool (one fully shielded self-send),
 * then each piece leaves the pool on its own schedule. Pieces are re-checked right before sending.
 */
export interface ExitPiece {
  amount: string;
  /** Unix seconds when this piece may be sent. */
  dueAt: number;
  status: 'waiting' | 'sent' | 'failed';
  txid?: string;
  sentAt?: number;
  error?: string;
  /** Assessment at send time. */
  level?: Assessment['level'];
  crowd?: number;
  /** Times this piece was held back because it scored red. */
  holds?: number;
}

/** A red piece is held and re-checked later, up to MAX_HOLDS times, then sent so funds are never stuck. */
const MAX_HOLDS = 6;
const HOLD_SECS = 2 * 3600;

export interface ExitJob {
  id: string;
  account: number;
  destination: string;
  createdAt: number;
  prepareTxid: string;
  remainderStaysShielded: string;
  pieces: ExitPiece[];
}

const FILE = () => join(config.dataDir, 'jobs.json');

export class JobStore {
  jobs: ExitJob[] = [];
  private busy = false;

  async load() {
    try {
      this.jobs = JSON.parse(await readFile(FILE(), 'utf8'));
    } catch {
      /* none yet */
    }
  }

  async save() {
    await mkdir(config.dataDir, { recursive: true });
    await writeFile(FILE() + '.tmp', JSON.stringify(this.jobs, null, 2));
    await rename(FILE() + '.tmp', FILE());
  }

  async add(job: Omit<ExitJob, 'id' | 'createdAt'>) {
    const j: ExitJob = { ...job, id: randomUUID(), createdAt: Math.floor(Date.now() / 1000) };
    this.jobs.unshift(j);
    await this.save();
    return j;
  }

  /** Send every piece that is due. Notes from the prepare step must be mined first; until then the wallet refuses and we retry. */
  async tick(index: () => BoundaryIndex, log = console.log) {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = Math.floor(Date.now() / 1000);
      for (const job of this.jobs) {
        for (const p of job.pieces) {
          if (p.status !== 'waiting' || p.dueAt > now) continue;
          const a = assess(index(), { zats: toZats(p.amount), time: now });
          p.level = a.level;
          p.crowd = a.crowd;
          if (a.level === 'red' && (p.holds ?? 0) < MAX_HOLDS) {
            // Still easy to link: wait for the crowd to grow instead of sending.
            p.holds = (p.holds ?? 0) + 1;
            p.dueAt = now + Math.max(60, Math.round(HOLD_SECS * config.exitDelayScale));
            p.error = `held: ${a.reason}`;
            log(`job ${job.id.slice(0, 8)}: held ${p.amount} (red, crowd ${a.crowd}), retry #${p.holds}`);
            await this.save();
            continue;
          }
          try {
            p.txid = await wallet(job.account).pay([{ address: job.destination, amount: p.amount }]);
            p.status = 'sent';
            p.sentAt = now;
            delete p.error;
            log(`job ${job.id.slice(0, 8)}: sent ${p.amount} → ${job.destination.slice(0, 12)}… ${p.txid}`);
          } catch (e) {
            const msg = (e as Error).message;
            // Not yet spendable (prepare notes unconfirmed): try again on the next tick.
            if (/feasible|insufficient|not enough|confirm/i.test(msg)) p.error = `waiting for funds: ${msg}`;
            else {
              p.status = 'failed';
              p.error = msg;
            }
          }
          await this.save();
          break; // at most one send per job per tick, so pieces never share a block
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
