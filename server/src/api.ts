import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { assess, commonDenominations, planExit, toZats, toZec } from 'mirage-core';
import type { Indexer } from './indexer.js';
import { wallet } from './zkool.js';

const SHIELDED_PREFIXES = ['utest1', 'ztestsapling'];
const TRANSPARENT_PREFIXES = ['tm', 'tex'];
const isShielded = (a: string) => SHIELDED_PREFIXES.some((p) => a.startsWith(p));
const isTransparent = (a: string) => TRANSPARENT_PREFIXES.some((p) => a.startsWith(p));
const MAX_DEMO_ZEC = 1; // testnet demo cap per request
const explorer = (txid: string) => `https://zexplorer.app/testnet/tx/${txid}`;

export function createApi(indexer: Indexer) {
  const app = new Hono();
  app.use('/api/*', cors());

  app.get('/api/health', (c) => c.json({ ok: true, toHeight: indexer.index.toHeight, crossings: indexer.index.crossings.length }));

  /** The whole public boundary index. Clients score locally so we never learn which amount they're checking. */
  app.get('/api/index', (c) => c.json(indexer.index));

  // ---- Demo wallet (zkool). Bound to localhost only; see README. ----

  app.get('/api/wallet', async (c) => {
    await wallet.sync();
    return c.json({ address: await wallet.address(), balance: await wallet.balance() });
  });

  /** Incoming shielded payments to the demo wallet, with decrypted memos (read via the wallet's keys). */
  app.get('/api/incoming', async (c) => {
    await wallet.sync();
    const txs = await wallet.transactions();
    const incoming = txs.flatMap((t) =>
      t.notes
        .filter((n) => n.scope === 0 && n.pool !== 0)
        .map((n) => ({ txid: t.txid, height: t.height, time: t.time, amount: n.value, memo: n.memo, pool: n.pool, explorer: explorer(t.txid) })),
    );
    return c.json(incoming.sort((a, b) => (b.height || 1e12) - (a.height || 1e12)));
  });

  /** Fully shielded payment with an encrypted memo. Shielded recipients only. */
  app.post('/api/pay-shielded', async (c) => {
    const { address, amount, memo } = await c.req.json<{ address: string; amount: string; memo?: string }>();
    if (!isShielded(address)) return c.json({ error: 'recipient must be a shielded testnet address (utest1 / ztestsapling)' }, 400);
    if (!(Number(amount) > 0 && Number(amount) <= MAX_DEMO_ZEC)) return c.json({ error: `amount must be in (0, ${MAX_DEMO_ZEC}]` }, 400);
    if (memo && Buffer.byteLength(memo) > 512) return c.json({ error: 'memo over 512 bytes' }, 400);
    const txid = await wallet.pay([{ address, amount, memo }]);
    return c.json({ txid, explorer: explorer(txid) });
  });

  /**
   * Score a planned exit to a transparent address against the index (server-side convenience for the CLI and tests;
   * the web app scores locally with mirage-core).
   */
  app.post('/api/assess', async (c) => {
    const { amount, time } = await c.req.json<{ amount: string; time?: number }>();
    const exit = { zats: toZats(amount), time: time ?? Math.floor(Date.now() / 1000) };
    const a = assess(indexer.index, exit);
    return c.json({ ...a, candidates: a.candidates.map((x) => ({ ...x, explorer: explorer(x.txid) })) });
  });

  /**
   * Prepare step, fully shielded: a self-send that splits `amount` into common denominations inside the pool.
   * Returns the plan, the txid and the notes created. Nothing leaves the shielded pool.
   */
  app.post('/api/prepare', async (c) => {
    const { amount } = await c.req.json<{ amount: string }>();
    if (!(Number(amount) > 0 && Number(amount) <= MAX_DEMO_ZEC)) return c.json({ error: `amount must be in (0, ${MAX_DEMO_ZEC}]` }, 400);
    const plan = planExit(toZats(amount), { denominations: commonDenominations(indexer.index) });
    if (!plan.pieces.length) return c.json({ error: 'amount too small to split into common denominations', plan }, 400);
    const self = await wallet.address();
    const recipients = plan.pieces.map((p, i) => ({ address: self, amount: toZec(p.zats), memo: `mirage:prepare ${i + 1}/${plan.pieces.length}` }));
    const txid = await wallet.pay(recipients);
    return c.json({
      txid,
      explorer: explorer(txid),
      notes: plan.pieces.map((p) => ({ amount: toZec(p.zats), suggestedExitAt: p.at })),
      remainderStaysShielded: toZec(plan.remainderZats),
    });
  });

  /** Optional exit of one prepared piece to a transparent address, after scoring it. */
  app.post('/api/exit', async (c) => {
    const { address, amount, force } = await c.req.json<{ address: string; amount: string; force?: boolean }>();
    if (!isTransparent(address)) return c.json({ error: 'exit destination must be a transparent testnet address (tm / tex)' }, 400);
    if (!(Number(amount) > 0 && Number(amount) <= MAX_DEMO_ZEC)) return c.json({ error: `amount must be in (0, ${MAX_DEMO_ZEC}]` }, 400);
    const a = assess(indexer.index, { zats: toZats(amount), time: Math.floor(Date.now() / 1000) });
    if (a.level === 'red' && !force) return c.json({ blocked: true, assessment: a }, 409);
    const txid = await wallet.pay([{ address, amount }]);
    return c.json({ txid, explorer: explorer(txid), assessment: a });
  });

  app.onError((err, c) => c.json({ error: err.message }, 500));
  return app;
}
