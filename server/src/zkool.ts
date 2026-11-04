import { config } from './config.js';

/** Minimal client for a zkool_graphql wallet server. Keep that server private: it is unauthenticated. */
export async function gql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await fetch(config.zkoolUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data as T;
}

export interface WalletTx {
  txid: string; height: number; time: number; value: string; fee: string;
  notes: { pool: number; value: string; scope: number; memo: string | null }[];
}

/** Wallet operations for one zkool account. */
export function wallet(id: number) {
  const w = {
    id,
    sync: () => gql<{ synchronize: number }>(`mutation { synchronize(idAccounts: [${id}]) }`),
    name: async () => {
      const d = await gql(`{ accounts { id name } }`).catch(() => null);
      return (d?.accounts as { id: number; name: string }[] | undefined)?.find((a) => a.id === id)?.name ?? `account ${id}`;
    },
    address: async () => (await gql(`{ addressByAccount(idAccount: ${id}) { ua } }`)).addressByAccount.ua as string,
    balance: async () =>
      (await gql(`{ balanceByAccount(idAccount: ${id}) { transparent sapling orchard ironwood } }`)).balanceByAccount as Record<string, string>,
    transactions: async () =>
      (await gql(`{ transactionsByAccount(idAccount: ${id}) { txid height time value fee notes { pool value scope memo } } }`))
        .transactionsByAccount as WalletTx[],
    /** Shielded-source payment to one or more recipients. Syncs first so note selection sees the latest state. */
    pay: async (recipients: { address: string; amount: string; memo?: string }[]) => {
      await w.sync();
      const d = await gql<{ pay: string }>(`mutation Pay($p: Payment!) { pay(idAccount: ${id}, payment: $p) }`, {
        p: { recipients, confirmations: 1 },
      });
      return d.pay;
    },
  };
  return w;
}

export type Wallet = ReturnType<typeof wallet>;
