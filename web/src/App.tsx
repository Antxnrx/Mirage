import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorNote, HowItWorks } from '@/components/mirage';
import { api } from '@/lib/api';
import { usePoll } from '@/lib/hooks';
import AddWallet from '@/views/AddWallet';
import Check from '@/views/Check';
import ExitDetail from '@/views/ExitDetail';
import Home from '@/views/Home';
import Receive from '@/views/Receive';
import Report from '@/views/Report';
import Send from '@/views/Send';

export type View = { name: 'home' } | { name: 'send' } | { name: 'receive' } | { name: 'check' } | { name: 'add' } | { name: 'exit'; id: string } | { name: 'report' };

// Not a wallet id. Picking this row in the wallet list opens the Add wallet page.
const ADD_WALLET = 'add';

export default function App() {
  const accounts = usePoll(() => api.accounts(), null, []);
  const [view, setView] = useState<View>({ name: 'home' });
  const usedPointer = useRef(false);
  const [accountId, setAccountId] = useState<number | null>(() => Number(localStorage.getItem('mirage.account')) || null);

  const list = accounts.data ?? [];
  const account = list.find((a) => a.id === accountId) ?? list[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  function pickWallet(id: number) {
    setAccountId(id);
    localStorage.setItem('mirage.account', String(id));
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      {/* Equal outer columns keep the wallet selector centred however wide the sides are. */}
      <header className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="flex items-center gap-2 justify-self-start font-medium tracking-tight">
          <span className="size-4 rounded-full bg-primary" aria-hidden />
          Mirage
        </span>
        <div className="min-w-0 justify-self-center">
          {account ? (
            // Locked outside Home, so a send can never switch wallets halfway through.
            <Select
              value={String(account.id)}
              disabled={view.name !== 'home'}
              onValueChange={(v) => (v === ADD_WALLET ? setView({ name: 'add' }) : pickWallet(Number(v)))}
            >
              {/* Deliberately borderless, open or closed: just the name and a chevron. */}
              <SelectTrigger
                size="sm"
                aria-label="Wallet"
                onPointerDown={() => (usedPointer.current = true)}
                onKeyDown={() => (usedPointer.current = false)}
                // Keyboard focus shows as yellow underlined text instead of a ring, so there's still no box.
                className="max-w-40 gap-1 rounded-full border-0 bg-transparent px-2 font-medium text-foreground shadow-none hover:text-primary focus-visible:text-primary focus-visible:underline focus-visible:underline-offset-4 focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent dark:hover:bg-transparent [&_svg]:transition-transform data-[state=open]:[&_svg]:rotate-180"
              >
                <SelectValue />
              </SelectTrigger>
              {/* The same-colour shadow feathers the backing into the page, so the list has no visible edge. */}
              <SelectContent
                position="popper"
                align="center"
                sideOffset={4}
                className="min-w-0 border-0 bg-background shadow-[0_0_20px_16px_var(--background)]"
                onKeyDown={() => (usedPointer.current = false)}
                onCloseAutoFocus={(e) => {
                  if (usedPointer.current) e.preventDefault();
                }}
              >
                {list.map((a) => (
                  <SelectItem
                    key={a.id}
                    value={String(a.id)}
                    className="justify-center rounded-full py-2 font-medium text-muted-foreground focus:bg-transparent focus:text-primary data-[state=checked]:text-foreground"
                  >
                    {a.name}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_WALLET} className="mt-1 justify-center rounded-full py-2 font-medium text-muted-foreground focus:bg-transparent focus:text-primary [&_svg:not([class*='text-'])]:text-current">
                  <Plus aria-hidden />
                  Add wallet
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            accounts.loading && <Skeleton className="h-8 w-28 rounded-full" />
          )}
        </div>
        <span className="justify-self-end rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title="Coins on this network have no real value">
          Testnet
        </span>
      </header>

      <main className={view.name === 'home' ? 'flex flex-1 flex-col pb-8' : 'flex flex-1 flex-col'}>
        {accounts.error && !account ? (
          <ErrorNote error={accounts.error} onRetry={accounts.reload} />
        ) : !account ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : view.name === 'send' ? (
          <Send account={account} onExit={() => setView({ name: 'home' })} onOpenExit={(id) => setView({ name: 'exit', id })} />
        ) : view.name === 'report' ? (
          <Report account={account} onBack={() => setView({ name: 'home' })} />
        ) : view.name === 'check' ? (
          <Check onBack={() => setView({ name: 'home' })} onSend={() => setView({ name: 'send' })} />
        ) : view.name === 'receive' ? (
          <Receive account={account} onBack={() => setView({ name: 'home' })} />
        ) : view.name === 'add' ? (
          <AddWallet
            accounts={list}
            currentId={account.id}
            onBack={() => setView({ name: 'home' })}
            onPick={(id) => {
              pickWallet(id);
              setView({ name: 'home' });
            }}
          />
        ) : view.name === 'exit' ? (
          <ExitDetail account={account} id={view.id} onBack={() => setView({ name: 'home' })} />
        ) : (
          <Home key={account.id} account={account} onSend={() => setView({ name: 'send' })} onReceive={() => setView({ name: 'receive' })} onCheck={() => setView({ name: 'check' })} onReport={() => setView({ name: 'report' })} onOpenExit={(id) => setView({ name: 'exit', id })} />
        )}
      </main>

      {/* Home only. On inner pages the main action is the last thing on screen. */}
      {view.name === 'home' && (
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 text-xs text-muted-foreground">
          <span>Testnet coins (TAZ) have no value.</span>
          <HowItWorks>
            <button type="button" className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              How Mirage decides
            </button>
          </HowItWorks>
        </footer>
      )}
    </div>
  );
}
