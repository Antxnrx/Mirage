// Typed client for the Mirage API. Contract: AGENTS.md section 5.

export type Level = 'red' | 'amber' | 'green';

export interface Account { id: number; name: string; address: string }
export interface Balance { transparent: string; sapling: string; orchard: string; ironwood: string }
export interface Wallet { account: number; address: string; balance: Balance }
export interface Health { ok: boolean; network: string; toHeight: number; crossings: number; limits: { maxPerRequestZec: number; sendsPerHour: number } }
export interface ReceivedNote { amount: string; memo: string | null; pool: number }
export interface Tx { txid: string; height: number | null; time: number; net: string; fee: string; received: ReceivedNote[]; explorer: string }
export interface Candidate { txid: string; time: number; zats: number; explorer?: string }
export interface Assessment { level: Level; crowd: number; reason: string; candidates: Candidate[] }
export interface ProposedPiece { amount: string; delaySecs: number }
export interface Proposal { pieces: ProposedPiece[]; remainderStaysShielded: string }
export interface ExitPiece {
  amount: string;
  dueAt: number;
  status: 'waiting' | 'sending' | 'sent' | 'failed';
  level?: Level;
  crowd?: number;
  holds?: number;
  txid?: string;
  explorer?: string;
  sentAt?: number;
  error?: string;
}
export interface ExitJob {
  id: string;
  account: number;
  destination: string;
  createdAt: number;
  prepareTxid: string;
  prepareExplorer: string;
  remainderStaysShielded: string;
  pieces: ExitPiece[];
}
export type SendResult =
  | { route: 'shielded'; sent: true; txid: string; explorer: string; note: string }
  | { route: 'transparent'; sent: true; txid: string; explorer: string; assessment: Assessment; forced: boolean }
  | { route: 'guarded'; sent: false; assessment: Assessment; proposal: Proposal };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Same origin by default. ?api=<url> points the page at another server and is remembered,
// and an empty ?api= resets it. See AGENTS.md, "Frontend-only work".
const API_BASE = (() => {
  const q = new URLSearchParams(location.search).get('api');
  try {
    if (q !== null) localStorage.setItem('mirage.api', q);
    return (q ?? localStorage.getItem('mirage.api') ?? '').replace(/\/$/, '');
  } catch {
    return (q ?? '').replace(/\/$/, '');
  }
})();

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      API_BASE + path,
      body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined,
    );
  } catch {
    throw new ApiError(0, "Can't reach Mirage. Check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || `Something went wrong (HTTP ${res.status}).`);
  return json as T;
}

export const api = {
  health: () => request<Health>('/api/health'),
  accounts: () => request<Account[]>('/api/accounts'),
  wallet: (account: number) => request<Wallet>(`/api/wallet?account=${account}`),
  activity: (account: number) => request<Tx[]>(`/api/activity?account=${account}`),
  exits: (account: number) => request<ExitJob[]>(`/api/exits?account=${account}`),
  assess: (amount: string) => request<Assessment>('/api/assess', { amount }),
  // These two spend funds and only return once the wallet has built its proof (~20-25 s when hosted).
  send: (b: { account: number; address: string; amount: string; memo?: string; force?: boolean }) => request<SendResult>('/api/send', b),
  guardedExit: (b: { account: number; address: string; amount: string }) =>
    request<{ job: ExitJob; prepareExplorer: string }>('/api/guarded-exit', b),
};
