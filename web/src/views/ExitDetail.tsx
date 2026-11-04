import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Hourglass, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorNote, ExitSummary, LevelChip, PageHeader, TxLink } from '@/components/mirage';
import { api, type Account, type ExitPiece } from '@/lib/api';
import { duration, shortAddr, taz, zats } from '@/lib/format';
import { useNow, usePoll } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export default function ExitDetail({ account, id, onBack }: { account: Account; id: string; onBack: () => void }) {
  const exits = usePoll(() => api.exits(account.id), 10_000, [account.id]);
  const now = useNow();
  const job = exits.data?.find((j) => j.id === id);

  return (
    <div>
      <PageHeader title="Safe exit" onBack={onBack} />

      {exits.error && !exits.data ? (
        <ErrorNote error={exits.error} onRetry={exits.reload} />
      ) : !exits.data ? (
        <Skeleton className="mt-4 h-64 w-full rounded-[1.75rem]" />
      ) : !job ? (
        <p className="py-6 text-center text-sm text-muted-foreground">This safe exit isn't in this wallet.</p>
      ) : (
        <div className="space-y-6 pt-4">
          <section className="surface block p-5">
            <ExitSummary job={job} />
            <p className="mt-4 flex items-baseline justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
              To <span className="font-mono text-xs text-foreground">{shortAddr(job.destination)}</span>
            </p>
          </section>

          <section className="pt-2">
            <h2 className="caps mb-1">Timeline</h2>
            <ol aria-live="polite">
              <Step icon={<ShieldCheck className="size-4" aria-hidden />} tone="success">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">Split privately</p>
                  <TxLink txid={job.prepareTxid} href={job.prepareExplorer} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Hidden inside the pool. Nobody can see this split.</p>
              </Step>
              {job.pieces.map((p, i) => (
                <PieceStep key={i} piece={p} now={now} last={i === job.pieces.length - 1 && zats(job.remainderStaysShielded) === 0} />
              ))}
              {zats(job.remainderStaysShielded) > 0 && (
                <Step last icon={<ShieldCheck className="size-4" aria-hidden />} tone="success">
                  <p className="text-sm font-medium tabular-nums">{taz(job.remainderStaysShielded)} TAZ stays private</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Too small to blend in, so it stays in your wallet.</p>
                </Step>
              )}
            </ol>
          </section>
          <p className="px-1 text-center text-xs text-pretty text-muted-foreground">Mirage checks each piece again right before it leaves. You can close this page, and the pieces will still go out on schedule.</p>
        </div>
      )}
    </div>
  );
}

const STEP_TONE = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-primary/10 text-primary',
};

function Step({ icon, tone, last, children }: { icon: ReactNode; tone: keyof typeof STEP_TONE; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-3 py-3">
      {!last && <span className="absolute top-14 -bottom-1 left-5 w-px bg-border" aria-hidden />}
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', STEP_TONE[tone])}>{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function PieceStep({ piece: p, now, last }: { piece: ExitPiece; now: number; last: boolean }) {
  const left = p.dueAt - now;
  const held = (p.holds ?? 0) > 0;
  const waitingForFunds = p.error?.startsWith('waiting for funds');
  const state: { icon: ReactNode; text: string; tone: keyof typeof STEP_TONE; textClass: string } =
    p.status === 'sent'
      ? { icon: <CheckCircle2 className="size-4" aria-hidden />, text: p.sentAt ? `Sent ${new Date(p.sentAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sent', tone: 'success', textClass: 'text-success' }
      : p.status === 'sending'
        ? { icon: <Loader2 className="size-4 animate-spin" aria-hidden />, text: 'Sending now. Building the proof…', tone: 'brand', textClass: 'text-foreground' }
        : p.status === 'failed'
          ? { icon: <XCircle className="size-4" aria-hidden />, text: p.error ? p.error[0].toUpperCase() + p.error.slice(1) : 'Failed', tone: 'danger', textClass: 'text-destructive' }
          : waitingForFunds
            ? { icon: <Hourglass className="size-4" aria-hidden />, text: 'Waiting for funds to unlock', tone: 'warning', textClass: 'text-warning' }
            : held
              ? { icon: <Hourglass className="size-4" aria-hidden />, text: `Held ${p.holds} ${p.holds === 1 ? 'time' : 'times'}: it would still stand out. Checking again soon.`, tone: 'warning', textClass: 'text-warning' }
              : left > 0
                ? { icon: <Clock className="size-4" aria-hidden />, text: `Leaves in ${duration(left)}`, tone: 'neutral', textClass: 'text-muted-foreground' }
                : { icon: <Loader2 className="size-4 animate-spin" aria-hidden />, text: 'Checking the crowd now…', tone: 'neutral', textClass: 'text-muted-foreground' };
  return (
    <Step icon={state.icon} tone={state.tone} last={last}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium tabular-nums">{taz(p.amount)} TAZ</p>
        {p.txid && p.explorer && <TxLink txid={p.txid} href={p.explorer} />}
      </div>
      <p className={cn('mt-0.5 text-xs tabular-nums text-pretty', state.textClass)} aria-live="off">
        {state.text}
      </p>
      {p.level && (
        <div className="mt-1.5 flex items-center gap-2">
          <LevelChip level={p.level} />
          {p.crowd !== undefined && <span className="text-xs text-muted-foreground">Crowd of {p.crowd}</span>}
        </div>
      )}
    </Step>
  );
}
