import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Blocks, ChevronDown, ChevronRight, Clock, Eye, EyeOff, History, ShieldCheck, Shuffle, Split, TrendingUp, Users } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AmountFigure, ErrorNote, exitTotals, ExitStatus, ExitSummary, HIDDEN, Row, toneSurface, TxLink, type Tone } from '@/components/mirage';
import { api, type Account, type ExitJob, type Health, type Tx, type Wallet } from '@/lib/api';
import { ago, describeTx, POOL, privateZats, taz, zats, type TxKind, type TxView } from '@/lib/format';
import { useNow, usePoll } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import balanceCoin from '@/assets/balance-coin.webp';

export default function Home({ account, onSend, onReceive, onCheck, onReport, onOpenExit }: { account: Account; onSend: () => void; onReceive: () => void; onCheck: () => void; onReport: () => void; onOpenExit: (id: string) => void }) {
  const wallet = usePoll(() => api.wallet(account.id), 30_000, [account.id]);
  const activity = usePoll(() => api.activity(account.id), 30_000, [account.id]);
  const exits = usePoll(() => api.exits(account.id), 15_000, [account.id]);
  const health = usePoll(() => api.health(), 30_000, []);
  const [hidden, setHidden] = useState(() => localStorage.getItem('mirage.hideAmounts') === '1');
  const jobs = useMemo(() => [...(exits.data ?? [])].sort((a, b) => b.createdAt - a.createdAt), [exits.data]);

  const toggleHidden = () => {
    setHidden((h) => {
      localStorage.setItem('mirage.hideAmounts', h ? '0' : '1');
      return !h;
    });
  };
  const showHistory = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('activity')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-7">
      <BalanceBlock wallet={wallet.data} activity={activity.data} error={wallet.error} retry={wallet.reload} hidden={hidden} onToggleHidden={toggleHidden} />

      <nav className="grid grid-cols-4 gap-3" aria-label="Wallet actions">
        <ActionTile label="Send" onClick={onSend} accent>
          <ArrowUpRight />
        </ActionTile>
        <ActionTile label="Receive" onClick={onReceive}>
          <ArrowDownLeft />
        </ActionTile>
        <ActionTile label="Check" onClick={onCheck}>
          <ShieldCheck />
        </ActionTile>
        <ActionTile label="History" onClick={showHistory}>
          <History />
        </ActionTile>
      </nav>

      <button type="button" onClick={onReport} className="surface group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent">
        <span className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success [&_svg]:size-5"><ShieldCheck /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Privacy report</span>
          <span className="block text-xs text-muted-foreground">How linkable was each money exit from this wallet?</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground" />
      </button>

      {jobs[0] && <ExitCard job={jobs[0]} hidden={hidden} onOpen={() => onOpenExit(jobs[0].id)} />}

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users />} label="Crossings" value={health.data?.crossings.toLocaleString('en-US')} note="Public, on this network" />
        <PulseCard jobs={jobs} health={health.data} />
      </div>

      {jobs.length > 1 && (
        <ul className="space-y-2" aria-label="Earlier safe exits">
          {jobs.slice(1, 3).map((j) => (
            <li key={j.id}>
              <ExitRow job={j} hidden={hidden} onOpen={() => onOpenExit(j.id)} />
            </li>
          ))}
        </ul>
      )}

      <section id="activity" aria-labelledby="activity-heading" className="scroll-mt-4 pt-2">
        <h2 id="activity-heading" className="caps mb-1">
          Activity
        </h2>
        {activity.error && !activity.data ? (
          <div className="py-3">
            <ErrorNote error={activity.error} onRetry={activity.reload} />
          </div>
        ) : !activity.data ? (
          <div className="space-y-2 py-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : activity.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity yet. Share your address to get paid, or claim test coins from{' '}
            <a className="underline underline-offset-4 hover:text-foreground" href="https://fauzec.com" target="_blank" rel="noopener noreferrer">
              the Fauzec faucet
            </a>
            .
          </p>
        ) : (
          <ul className="divide-y">
            {activity.data.slice(0, 15).map((t) => (
              <TxRow key={t.txid} tx={t} jobs={jobs} hidden={hidden} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionTile({ label, onClick, accent, children }: { label: string; onClick: () => void; accent?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-2 rounded-2xl focus-visible:outline-none">
      <span
        className={cn(
          'surface-sm flex aspect-square w-full max-w-[4.5rem] items-center justify-center rounded-[1.4rem] transition-colors group-hover:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring [&_svg]:size-7 [&_svg]:stroke-[1.75]',
          accent && 'text-primary',
        )}
      >
        {children}
      </span>
      <span className="text-sm text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

function BalanceBlock({ wallet, activity, error, retry, hidden, onToggleHidden }: { wallet?: Wallet; activity?: Tx[]; error?: Error; retry: () => void; hidden: boolean; onToggleHidden: () => void }) {
  // Real incoming money only. Self-sends and prepare steps never have a positive net.
  const received = useMemo(() => {
    const since = Date.now() / 1000 - 86_400;
    return (activity ?? []).filter((t) => t.height && t.time >= since && zats(t.net) > 0).reduce((s, t) => s + zats(t.net), 0);
  }, [activity]);

  if (error && !wallet) return <ErrorNote error={error} onRetry={retry} />;
  if (!wallet) return <Skeleton className="mt-2 h-60 w-full rounded-[1.75rem]" />;
  const b = wallet.balance;
  const pub = zats(b.transparent);
  return (
    <Collapsible>
      <section aria-label="Balance" className="surface relative isolate mt-2 flex min-h-60 flex-col justify-center overflow-hidden px-5 py-8 text-center [text-shadow:0_1px_14px_rgb(0_0_0/0.65)]">
        {/* Decorative, at 12% opacity. The slight zoom crops the rounded frame built into the image. */}
        <img src={balanceCoin} alt="" aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full scale-110 object-cover opacity-[0.12] select-none" />
        <p className="flex items-center justify-center gap-1.5 text-sm text-foreground/85">
          Private balance
          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
            aria-pressed={hidden}
            className="-m-1 rounded-full p-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </p>
        <p className="mt-3 flex items-baseline justify-center gap-2">
          {hidden ? <span className="text-[3.5rem] leading-none font-medium tracking-tight">{HIDDEN}</span> : <AmountFigure value={privateZats(b) / 1e8} dimClassName="text-foreground/70" />}
          <span className="text-lg text-foreground/80">TAZ</span>
        </p>
        <CollapsibleTrigger
          className={cn(
            'group mx-auto mt-4 flex items-center gap-1.5 rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            received > 0 && !hidden ? 'text-success' : 'text-foreground/85 hover:text-foreground',
          )}
        >
          {received > 0 && !hidden ? (
            <>
              <TrendingUp className="size-4" aria-hidden />
              +{taz(received / 1e8)} TAZ in 24 h
            </>
          ) : pub > 0 && !hidden ? (
            `Plus ${taz(pub / 1e8)} TAZ public`
          ) : (
            'Balance details'
          )}
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
      </section>
      {/* Opens below the card, so the image stays still and the rows don't sit on top of the coin. */}
      <CollapsibleContent>
        <dl className="surface mt-4 divide-y px-5 py-1.5 text-left tabular-nums">
          <Row label="Ironwood (private)">{hidden ? HIDDEN : taz(b.ironwood)}</Row>
          <Row label="Orchard (private)">{hidden ? HIDDEN : taz(b.orchard)}</Row>
          <Row label="Sapling (private)">{hidden ? HIDDEN : taz(b.sapling)}</Row>
          <Row label="Transparent (public)">{hidden ? HIDDEN : taz(b.transparent)}</Row>
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExitCard({ job, hidden, onOpen }: { job: ExitJob; hidden: boolean; onOpen: () => void }) {
  const { count } = exitTotals(job);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Safe exit: ${count} of ${job.pieces.length} sent. Open details.`}
      className="surface block w-full p-5 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <ExitSummary job={job} hidden={hidden} trailing={<ChevronRight className="size-4" aria-hidden />} />
    </button>
  );
}

function ExitRow({ job, hidden, onOpen }: { job: ExitJob; hidden: boolean; onOpen: () => void }) {
  const { total, count } = exitTotals(job);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-sm flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium tabular-nums">{hidden ? HIDDEN : `${taz(total / 1e8)} TAZ`}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {count} of {job.pieces.length} sent
        </span>
      </span>
      <ExitStatus job={job} />
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

function StatCard({ icon, label, value, note }: { icon: ReactNode; label: string; value?: string; note: string }) {
  return (
    <div className="surface p-4">
      <p className="caps flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:text-success">
        {icon}
        {label}
      </p>
      <p className="mt-3 min-h-8 text-2xl font-medium tracking-tight tabular-nums">{value ?? <Skeleton className="h-7 w-20" />}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

/** Counts down to the next piece of a running safe exit. With none running, shows the latest block. */
function PulseCard({ jobs, health }: { jobs: ExitJob[]; health?: Health }) {
  const now = useNow();
  const next = jobs
    .flatMap((j) => j.pieces)
    .filter((p) => p.status === 'waiting')
    .map((p) => p.dueAt)
    .sort((a, b) => a - b)[0];
  if (next === undefined) return <StatCard icon={<Blocks />} label="Block" value={health?.toHeight.toLocaleString('en-US')} note="Latest indexed" />;
  const left = Math.max(0, Math.round(next - now));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const unit = (n: number, u: string) => (
    <span>
      {String(n).padStart(2, '0')}
      <span className="ml-px text-xs font-medium text-success">{u}</span>
    </span>
  );
  return (
    <div className="surface p-4">
      <p className="caps flex items-center gap-1.5">
        <Clock className="size-4 text-success" aria-hidden />
        Next piece
      </p>
      <p className="mt-3 flex min-h-8 items-baseline gap-1.5 text-xl font-medium tracking-tight tabular-nums">
        {left > 0 ? (
          <>
            {h > 0 && unit(h, 'H')}
            {unit(m, 'M')}
            {unit(s, 'S')}
          </>
        ) : (
          'Checking'
        )}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{left > 0 ? 'Until it may leave' : 'Re-checking its crowd'}</p>
    </div>
  );
}

const KIND: Record<TxKind, { icon: typeof ArrowDownLeft; tone: Tone }> = {
  received: { icon: ArrowDownLeft, tone: 'success' },
  sent: { icon: ArrowUpRight, tone: 'neutral' },
  prepare: { icon: Shuffle, tone: 'brand' },
  'exit-piece': { icon: Split, tone: 'neutral' },
};

function TxRow({ tx, jobs, hidden }: { tx: Tx; jobs: ExitJob[]; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const v = describeTx(tx, jobs);
  const { icon: Icon, tone } = KIND[v.kind];
  return (
    <li>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-80 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', v.pending ? toneSurface.neutral : toneSurface[tone])}>
              {v.pending ? <Clock className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{v.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {v.pending ? 'Pending' : ago(tx.time)}
                {v.note ? ` · ${v.note}` : ''}
              </span>
            </span>
            <TxAmount view={v} hidden={hidden} />
          </button>
        </DialogTrigger>
        {open && <TxDetail tx={tx} view={v} />}
      </Dialog>
    </li>
  );
}

function TxAmount({ view: v, hidden }: { view: TxView; hidden: boolean }) {
  if (v.kind === 'prepare') return <span className="text-xs text-muted-foreground">Private</span>;
  if (hidden) return <span className="text-sm font-medium text-muted-foreground">{HIDDEN}</span>;
  const received = v.kind === 'received';
  return (
    <span className={cn('text-sm font-medium whitespace-nowrap tabular-nums', received && !v.pending ? 'text-success' : 'text-foreground')}>
      {received ? '+' : '−'}
      {taz(v.amount / 1e8)}
    </span>
  );
}

function TxDetail({ tx, view: v }: { tx: Tx; view: TxView }) {
  const memos = tx.received.map((n) => n.memo).filter((m): m is string => !!m && !m.startsWith('mirage:prepare'));
  const pools = [...new Set(tx.received.map((n) => n.pool))];
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{v.title}</DialogTitle>
        <DialogDescription>{v.note ?? (v.kind === 'sent' ? 'Sent from this wallet.' : 'Details of this transaction.')}</DialogDescription>
      </DialogHeader>
      <dl className="divide-y">
        {v.kind !== 'prepare' && <Row label="Amount"><span className="tabular-nums">{taz(v.amount / 1e8)} TAZ</span></Row>}
        <Row label="Network fee"><span className="tabular-nums">{taz(tx.fee)} TAZ</span></Row>
        <Row label="Status">{v.pending ? 'Pending' : `Mined in block ${Number(tx.height).toLocaleString('en-US')}`}</Row>
        {!v.pending && <Row label="When">{new Date(tx.time * 1000).toLocaleString()}</Row>}
        {pools.length > 0 && <Row label="Pool">{pools.map((p) => POOL[p] ?? `Pool ${p}`).join(', ')}</Row>}
        <Row label="Transaction"><TxLink txid={tx.txid} href={tx.explorer} /></Row>
      </dl>
      {memos.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Encrypted memo</p>
          {memos.map((m, i) => (
            <p key={i} className="mt-1 rounded-2xl bg-muted p-3 text-sm wrap-anywhere whitespace-pre-wrap">{m}</p>
          ))}
        </div>
      )}
    </DialogContent>
  );
}
