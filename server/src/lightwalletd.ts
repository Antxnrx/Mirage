import grpc from '@grpc/grpc-js';
import loader from '@grpc/proto-loader';
import { join } from 'node:path';
import { config } from './config.js';

export interface CompactTxIn { prevoutTxid: Buffer; prevoutIndex: number }
export interface TxOut { value: string; scriptPubKey: Buffer }
export interface CompactTx {
  index: string;
  txid: Buffer;
  fee: number;
  spends: unknown[];
  outputs: unknown[];
  actions: unknown[];
  ironwoodActions: unknown[];
  vin: CompactTxIn[];
  vout: TxOut[];
}
export interface CompactBlock { height: string; time: number; vtx: CompactTx[] }

const ALL_POOLS = ['TRANSPARENT', 'SAPLING', 'ORCHARD', 'IRONWOOD'];

/** Display order (byte-reversed hex), as explorers show txids. */
export const txidHex = (b: Buffer) => Buffer.from(b).reverse().toString('hex');
export const txidBytes = (hex: string) => Buffer.from(hex, 'hex').reverse();

export function createClient(host = config.lwdHost) {
  const def = loader.loadSync(join(config.protoDir, 'service.proto'), {
    includeDirs: [config.protoDir], longs: String, enums: String, defaults: true,
  });
  const pkg = grpc.loadPackageDefinition(def) as any;
  const c = new pkg.cash.z.wallet.sdk.rpc.CompactTxStreamer(host, grpc.credentials.createSsl(), {
    'grpc.max_receive_message_length': 64 << 20,
  });
  const unary = <T>(method: string, arg: unknown) =>
    new Promise<T>((res, rej) => c[method](arg, (e: Error | null, r: T) => (e ? rej(e) : res(r))));

  return {
    latestHeight: async () => Number((await unary<{ height: string }>('GetLatestBlock', {})).height),
    info: () => unary<Record<string, unknown>>('GetLightdInfo', {}),
    /** Height of the block containing a mined transaction. */
    txHeight: async (txid: string) => Number((await unary<{ height: string }>('GetTransaction', { hash: txidBytes(txid) })).height),
    block: (height: number) =>
      new Promise<CompactBlock>((res, rej) => {
        const blocks: CompactBlock[] = [];
        const s = c.GetBlockRange({ start: { height }, end: { height }, poolTypes: ALL_POOLS });
        s.on('data', (b: CompactBlock) => blocks.push(b));
        s.on('end', () => (blocks[0] ? res(blocks[0]) : rej(new Error(`block ${height} not returned`))));
        s.on('error', rej);
      }),
    /** Stream compact blocks (with transparent data) for an inclusive height range. */
    blockRange: (start: number, end: number, onBlock: (b: CompactBlock) => void) =>
      new Promise<void>((res, rej) => {
        const s = c.GetBlockRange({ start: { height: start }, end: { height: end }, poolTypes: ALL_POOLS });
        s.on('data', onBlock);
        s.on('end', () => res());
        s.on('error', rej);
      }),
    close: () => c.close(),
  };
}

export type LwdClient = ReturnType<typeof createClient>;
