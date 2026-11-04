import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = (k: string, d: string) => process.env[k] ?? d;

export const config = {
  lwdHost: env('LWD_HOST', 'testnet.zec.rocks:443'),
  zkoolUrl: env('ZKOOL_URL', 'http://127.0.0.1:8000/graphql'),
  zkoolAccountId: Number(env('ZKOOL_ACCOUNT_ID', '1')),
  port: Number(env('PORT', '8787')),
  host: env('HOST', '127.0.0.1'),
  backfillBlocks: Number(env('INDEX_BACKFILL_BLOCKS', '40000')),
  pollSecs: Number(env('INDEX_POLL_SECS', '30')),
  dataDir: resolve(here, '..', env('DATA_DIR', './data')),
  protoDir: resolve(here, '..', 'proto'),
};
