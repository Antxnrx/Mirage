import { relative } from 'node:path';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { assess, commonDenominations, planExit, toZats, toZec } from 'mirage-core';
import { config } from './config.js';
import type { Indexer } from './indexer.js';
import type { JobStore } from './jobs.js';
import { wallet } from './zkool.js';

const SHIELDED_PREFIXES = ['utest1', 'ztestsapling'];
const TRANSPARENT_PREFIXES = ['tm', 'texs'];
const isShielded = (a: string) => SHIELDED_PREFIXES.some((p) => a.startsWith(p));
const isTransparent = (a: string) => TRANSPARENT_PREFIXES.some((p) => a.startsWith(p));
const explorer = (txid: string) => `https://testnet.zecblock.com/tx/${txid}`;
const now = () => Math.floor(Date.now() / 1000);

class HttpError extends Error {
  constructor(public status: 400 | 404 | 409 | 429, message: string) {
    super(message);
  }
}

/** Rolling-hour limit on spending requests, shared by all callers. */
const spends: number[] = [];
function takeSpendSlot() {
  const cutoff = Date.now() - 3600_000;
  while (spends.length && spends[0] < cutoff) spends.shift();
  if (spends.length >= config.sendsPerHour) throw new HttpError(429, `demo limit: ${config.sendsPerHour} spending requests per hour`);
  spends.push(Date.now());
}

function checkAmount(amount: unknown): string {
  const n = Number(amount);
  if (!(n > 0) || n > config.maxPerRequestZec) throw new HttpError(400, `amount must be greater than 0 and at most ${config.maxPerRequestZec} TAZ`);
  return toZec(toZats(n));
}

function accountFrom(c: Context, body?: { account?: number }) {
  const id = Number(body?.account ?? c.req.query('account') ?? config.accounts[0]);
  if (!config.accounts.includes(id)) throw new HttpError(404, `unknown account ${id}`);
  return wallet(id);
}

export function createApi(indexer: Indexer, jobs: JobStore) {
  const app = new Hono();
  app.use('/api/*', cors());

  app.get('/api/health', (c) =>
    c.json({ ok: true, network: 'testnet', toHeight: indexer.index.toHeight, crossings: indexer.index.crossings.length, limits: { maxPerRequestZec: config.maxPerRequestZec, sendsPerHour: config.sendsPerHour } }),
  );

  /** The whole public boundary index. Clients can score locally so the server never learns what they check. */
  app.get('/api/index', (c) => c.json(indexer.index));

  /** Score a planned exit amount without sending anything. */
  app.post('/api/assess', async (c) => {
    const { amount } = await c.req.json<{ amount: string }>();
    const a = assess(indexer.index, { zats: toZats(amount), time: now() });
    return c.json({ ...a, candidates: a.candidates.map((x) => ({ ...x, explorer: explorer(x.txid) })) });
  });

  // ---- Wallet (zkool accounts listed in ZKOOL_ACCOUNTS) ----

  app.get('/api/accounts', async (c) =>
    c.json(await Promise.all(config.accounts.map(async (id) => ({ id, name: await wallet(id).name(), address: await wallet(id).address() })))),
  );

  app.get('/api/wallet', async (c) => {
    const w = accountFrom(c);
    await w.sync();
    return c.json({ account: w.id, address: await w.address(), balance: await w.balance() });
  });

  /** Recent activity: incoming shielded notes with decrypted memos, and outgoing payments. */
  app.get('/api/activity', async (c) => {
    const w = accountFrom(c);
    await w.sync();
    const txs = await w.transactions();
    return c.json(
      txs
        .map((t) => ({
          txid: t.txid,
          height: t.height,
          // zkool returns block time as a UTC string without a zone; expose Unix seconds like the rest of the API.
          time: typeof t.time === 'string' ? Math.floor(Date.parse(`${t.time}Z`) / 1000) : t.time,
          net: t.value,
          fee: t.fee,
          received: t.notes.filter((n) => n.scope === 0).map((n) => ({ amount: n.value, memo: n.memo, pool: n.pool })),
          explorer: explorer(t.txid),
        }))
        .sort((a, b) => (b.height || 1e12) - (a.height || 1e12)),
    );
  });

  /**
   * The guard: every send goes through here.
   * - Shielded destination: sent shielded right away. Nothing about it is public.
   * - Transparent destination: scored first. Green goes through; amber/red is held and a guarded exit is proposed.
   */
  app.post('/api/send', async (c) => {
    const body = await c.req.json<{ account?: number; address: string; amount: string; memo?: string; force?: boolean }>();
    const w = accountFrom(c, body);
    const amount = checkAmount(body.amount);
    const address = String(body.address ?? '').trim();
    if (body.memo && Buffer.byteLength(body.memo) > 512) throw new HttpError(400, 'memo over 512 bytes');

    if (isShielded(address)) {
      takeSpendSlot();
      const txid = await w.pay([{ address, amount, memo: body.memo || undefined }]);
      return c.json({ route: 'shielded', sent: true, txid, explorer: explorer(txid), note: 'Fully shielded: sender, receiver, amount and memo are private.' });
    }
    if (!isTransparent(address)) throw new HttpError(400, 'destination must be a testnet address (utest1…, ztestsapling…, tm…, texs…)');

    const assessment = assess(indexer.index, { zats: toZats(amount), time: now() });
    if (assessment.level === 'green' || body.force) {
      takeSpendSlot();
      const txid = await w.pay([{ address, amount }]);
      return c.json({ route: 'transparent', sent: true, forced: !!body.force && assessment.level !== 'green', txid, explorer: explorer(txid), assessment });
    }
    const plan = planExit(toZats(amount), { denominations: commonDenominations(indexer.index) });
    return c.json({
      route: 'guarded',
      sent: false,
      assessment: { ...assessment, candidates: assessment.candidates.map((x) => ({ ...x, explorer: explorer(x.txid) })) },
      proposal: {
        pieces: plan.pieces.map((p) => ({ amount: toZec(p.zats), delaySecs: Math.round((p.at - now()) * config.exitDelayScale) })),
        remainderStaysShielded: toZec(plan.remainderZats),
      },
    });
  });

  /**
   * Run a guarded exit: one fully shielded self-send splits the amount into common denominations,
   * then each piece is scheduled to leave the pool separately.
   */
  app.post('/api/guarded-exit', async (c) => {
    const body = await c.req.json<{ account?: number; address: string; amount: string }>();
    const w = accountFrom(c, body);
    const amount = checkAmount(body.amount);
    const address = String(body.address ?? '').trim();
    if (!isTransparent(address)) throw new HttpError(400, 'guarded exits are for transparent destinations (tm…, texs…); send shielded instead');
    const t0 = now();
    const plan = planExit(toZats(amount), { denominations: commonDenominations(indexer.index), now: t0 });
    if (!plan.pieces.length) throw new HttpError(400, 'amount too small to split into common denominations');
    takeSpendSlot();
    const self = await w.address();
    const prepareTxid = await w.pay(
      plan.pieces.map((p, i) => ({ address: self, amount: toZec(p.zats), memo: `mirage:prepare ${i + 1}/${plan.pieces.length}` })),
    );
    const job = await jobs.add({
      account: w.id,
      destination: address,
      prepareTxid,
      remainderStaysShielded: toZec(plan.remainderZats),
      pieces: plan.pieces.map((p) => ({ amount: toZec(p.zats), dueAt: t0 + Math.max(60, Math.round((p.at - t0) * config.exitDelayScale)), status: 'waiting' })),
    });
    return c.json({ job, prepareExplorer: explorer(prepareTxid) });
  });

  /**
   * Privacy report card: every past exit from this wallet that is visible on the public boundary,
   * re-scored as it looked at the moment it happened (its own crossing excluded). Reads only.
   */
  app.get('/api/report', async (c) => {
    const w = accountFrom(c);
    await w.sync();
    const txs = await w.transactions();
    // Only transactions this wallet paid for: incoming payments to its own transparent address are someone else's exit.
    const spent = new Set(txs.filter((t) => Number(t.value) < 0).map((t) => t.txid));
    const received = new Set(txs.filter((t) => Number(t.value) > 0).map((t) => t.txid));
    const crossings = indexer.index.crossings.filter((x) => (x.direction === 'deshield' ? spent : received).has(x.txid));
    const exits = crossings
      .filter((x) => x.direction === 'deshield' && x.zats !== null)
      .map((x) => {
        const others = { ...indexer.index, crossings: indexer.index.crossings.filter((y) => y.txid !== x.txid) };
        const a = assess(others, { zats: x.zats!, time: x.time });
        return { txid: x.txid, time: x.time, height: x.height, amount: toZec(x.zats!), level: a.level, crowd: a.crowd, reason: a.reason, explorer: explorer(x.txid) };
      })
      .sort((p, q) => q.time - p.time);
    const entries = crossings.filter((x) => x.direction === 'shield').length;
    const blended = exits.filter((e) => e.level === 'green').length;
    const linkable = exits.filter((e) => e.level === 'red').length;
    return c.json({
      account: w.id,
      exits,
      summary: {
        exits: exits.length, blended, narrow: exits.length - blended - linkable, linkable, entries,
        score: exits.length ? Math.round((100 * (blended + 0.5 * (exits.length - blended - linkable))) / exits.length) : null,
        indexedFrom: indexer.index.fromHeight, indexedTo: indexer.index.toHeight,
      },
    });
  });

  app.get('/api/exits', (c) => {
    const account = c.req.query('account');
    const list = account ? jobs.jobs.filter((j) => j.account === Number(account)) : jobs.jobs;
    return c.json(list.map((j) => ({ ...j, prepareExplorer: explorer(j.prepareTxid), pieces: j.pieces.map((p) => ({ ...p, explorer: p.txid ? explorer(p.txid) : undefined })) })));
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    if (/No feasible note selection/i.test(err.message))
      return c.json({ error: 'Not enough confirmed shielded funds yet. Funds from a recent transaction unlock after it is mined (about 30-90 s on testnet); try again shortly.' }, 409);
    return c.json({ error: err.message }, 500);
  });

  // Simple web UI
  app.use('/*', serveStatic({ root: relative(process.cwd(), config.publicDir) || '.' }));
  return app;
}
