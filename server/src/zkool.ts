import { config } from './config.js';

/** Minimal client for a zkool_graphql wallet server. Keep that server on localhost: it is unauthenticated. */
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

const acct = () => config.zkoolAccountId;

export const wallet = {
  sync: () => gql<{ synchronize: number }>(`mutation { synchronize(idAccounts: [${acct()}]) }`),
  address: async () => (await gql(`{ addressByAccount(idAccount: ${acct()}) { ua } }`)).addressByAccount.ua as string,
  balance: async () => (await gql(`{ balanceByAccount(idAccount: ${acct()}) { transparent sapling orchard ironwood } }`)).balanceByAccount,
  transactions: async () =>
    (
      await gql(`{ transactionsByAccount(idAccount: ${acct()}) { txid height time value fee notes { pool value scope memo } } }`)
    ).transactionsByAccount as {
      txid: string; height: number; time: number; value: string; fee: string;
      notes: { pool: number; value: string; scope: number; memo: string | null }[];
    }[],
  /** Shielded payment to one or more recipients. Syncs first so note selection sees the latest state. */
  pay: async (recipients: { address: string; amount: string; memo?: string }[]) => {
    await wallet.sync();
    const d = await gql<{ pay: string }>(
      `mutation Pay($p: Payment!) { pay(idAccount: ${acct()}, payment: $p) }`,
      { p: { recipients, confirmations: 1 } },
    );
    return d.pay;
  },
};
