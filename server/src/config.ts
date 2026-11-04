import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = (k: string, d: string) => process.env[k] ?? d;

export const config = {
  lwdHost: env('LWD_HOST', 'testnet.zec.rocks:443'),
  zkoolUrl: env('ZKOOL_URL', 'http://127.0.0.1:8000/graphql'),
  /** zkool account ids this server may use, e.g. "1,2". The first is the default. */
  accounts: env('ZKOOL_ACCOUNTS', env('ZKOOL_ACCOUNT_ID', '1')).split(',').map((s) => Number(s.trim())).filter(Boolean),
  port: Number(env('PORT', '8787')),
  host: env('HOST', '127.0.0.1'),
  backfillBlocks: Number(env('INDEX_BACKFILL_BLOCKS', '40000')),
  pollSecs: Number(env('INDEX_POLL_SECS', '30')),
  dataDir: resolve(here, '..', env('DATA_DIR', './data')),
  protoDir: resolve(here, '..', 'proto'),
  publicDir: resolve(here, '..', 'public'),
  /** Largest amount (ZEC) any single request may move. Testnet demo safety cap. */
  maxPerRequestZec: Number(env('MAX_PER_REQUEST_ZEC', '0.1')),
  /** Spending requests allowed per rolling hour, across all callers. */
  sendsPerHour: Number(env('SENDS_PER_HOUR', '30')),
  /**
   * Multiplier on planned exit delays. 1 = real schedule (hours); 0.01 turns ~3 h gaps into ~2 min for demos.
   */
  exitDelayScale: Number(env('EXIT_DELAY_SCALE', '1')),
  jobPollSecs: Number(env('JOB_POLL_SECS', '20')),
};
