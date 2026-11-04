import { Check, Plus, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/mirage';
import type { Account } from '@/lib/api';

/**
 * The API has no way to create a wallet yet (AGENTS.md section 5), so this page says so plainly
 * instead of offering a form that can't work. Choosing a wallet here does switch to it.
 */
export default function AddWallet({ accounts, currentId, onPick, onBack }: { accounts: Account[]; currentId: number; onPick: (id: number) => void; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Add wallet" onBack={onBack} />

      <section className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-primary" aria-hidden>
          <Plus className="size-6" />
        </span>
        <h2 className="text-lg font-medium tracking-tight">New wallets aren't available yet</h2>
        <p className="max-w-xs text-sm text-pretty text-muted-foreground">This testnet demo runs on the wallets already set up on its server. You can use any of them.</p>
      </section>

      <section aria-labelledby="wallet-list" className="space-y-2">
        <h2 id="wallet-list" className="text-sm text-muted-foreground">
          Available wallets
        </h2>
        <ul className="space-y-1">
          {accounts.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onPick(a.id)}
                aria-current={a.id === currentId ? 'true' : undefined}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
                  <Wallet className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                {a.id === currentId && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3.5" aria-hidden />
                    In use
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
