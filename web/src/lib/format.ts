import type { Balance, ExitJob, Level, Tx } from './api';

export const zats = (v: string | number) => Math.round(Number(v) * 1e8);

/** Up to 8 decimals with trailing zeros trimmed, keeping at least 4 so amounts line up. */
export function taz(v: string | number, minDp = 4) {
  const fixed = (zats(v) / 1e8).toFixed(8);
  const [int, dec] = fixed.split('.');
  const trimmed = dec.replace(/0+$/, '').padEnd(minDp, '0');
  return `${Number(int).toLocaleString('en-US')}.${trimmed}`;
}

export const privateZats = (b: Balance) => zats(b.sapling) + zats(b.orchard) + zats(b.ironwood);

export const shortAddr = (s: string, head = 10, tail = 6) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s);

export function ago(unix: number, now = Date.now() / 1000) {
  const s = Math.max(0, Math.round(now - unix));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(unix * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function duration(secs: number) {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

/** Coarser than duration, for plans where exact seconds would imply false precision. */
export function about(secs: number) {
  if (secs < 90) return 'about 1 min';
  if (secs < 3600) return `about ${Math.round(secs / 60)} min`;
  return `about ${Math.round(secs / 360) / 10} h`;
}

export type AddressKind = 'private' | 'public' | 'invalid' | 'empty';

export function addressKind(a: string): AddressKind {
  const v = a.trim();
  if (!v) return 'empty';
  if (v.startsWith('utest1') || v.startsWith('ztestsapling')) return 'private';
  if (v.startsWith('tm') || v.startsWith('texs')) return 'public';
  return 'invalid';
}

export const LEVEL: Record<Level, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  green: { label: 'Blends in', tone: 'success' },
  amber: { label: 'Small crowd', tone: 'warning' },
  red: { label: 'Easy to trace', tone: 'danger' },
};

export const POOL: Record<number, string> = { 0: 'Public', 1: 'Sapling', 2: 'Orchard', 3: 'Ironwood' };

export type TxKind = 'received' | 'sent' | 'prepare' | 'exit-piece';

export interface TxView {
  kind: TxKind;
  title: string;
  /** Money moved, excluding the fee. Zero for a prepare step, which only moves funds to yourself. */
  amount: number;
  note?: string;
  pending: boolean;
}

/** The API returns raw transactions, so work out what each one means to the person reading it. */
export function describeTx(t: Tx, jobs: ExitJob[]): TxView {
  const net = zats(t.net);
  const fee = zats(t.fee);
  const pending = !t.height;
  const memo = t.received.map((n) => n.memo).find(Boolean) ?? undefined;
  const isPrepare = jobs.some((j) => j.prepareTxid === t.txid) || t.received.some((n) => n.memo?.startsWith('mirage:prepare'));
  if (isPrepare) return { kind: 'prepare', title: 'Prepared a safe exit', amount: 0, note: `Split into ${t.received.length} pieces privately`, pending };
  const piece = jobs.flatMap((j) => j.pieces).find((p) => p.txid === t.txid);
  if (piece) {
    return {
      kind: 'exit-piece',
      title: 'Safe exit piece',
      amount: zats(piece.amount),
      note: piece.crowd !== undefined ? `Public · crowd of ${piece.crowd}` : 'Public',
      pending,
    };
  }
  if (net > 0) {
    const first = memo?.split('\n')[0];
    return { kind: 'received', title: 'Received', amount: net, note: first?.startsWith('fauzec/') ? 'From the Fauzec faucet' : first, pending };
  }
  return { kind: 'sent', title: 'Sent', amount: Math.abs(net) - fee, pending };
}

export type TxStage = 'seen' | 'mined' | 'confirmed';
/** Blocks after which we call a transaction confirmed. Our own UI threshold, not a protocol rule. */
export const CONFIRMATIONS = 3;
