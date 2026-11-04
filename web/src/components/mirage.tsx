import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, ExternalLink, Loader2, RotateCw, ShieldCheck, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ApiError, type Assessment, type ExitJob, type Level } from '@/lib/api';
import { ago, LEVEL, shortAddr, taz, zats, type TxStage } from '@/lib/format';
import { cn } from '@/lib/utils';

export const HIDDEN = '••••••';

/** The same header on every inner page. Back disappears once money is moving. */
export function PageHeader({ title, onBack, backLabel = 'Back to wallet', trailing, hideTitle }: { title: string; onBack?: () => void; backLabel?: string; trailing?: ReactNode; hideTitle?: boolean }) {
  return (
    <div className="mb-2 flex h-12 items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="surface-sm flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
      )}
      <h1 className={hideTitle ? 'sr-only' : 'text-lg font-medium tracking-tight'}>{title}</h1>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}

/**
 * Keeps a page's main action at the bottom of the screen. On short pages it sits at the very bottom,
 * and on long pages it stays in view while the content scrolls behind it.
 */
export function BottomAction({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-gradient-to-t from-background from-80% to-transparent px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>;
}

/** Two decimals in full white and the rest dimmed. TAZ balances are often below 1, so dimming every decimal would grey out the amount. */
export function AmountFigure({ value, dimClassName = 'text-muted-foreground/70' }: { value: string | number; dimClassName?: string }) {
  const [int, dec] = taz(value).split('.');
  return (
    <span className="text-[3.5rem] leading-none font-medium tracking-tight tabular-nums">
      {int}.{dec.slice(0, 2)}
      <span className={dimClassName}>{dec.slice(2)}</span>
    </span>
  );
}

/** The centred amount that opens a page, matching the balance on Home. */
export function AmountHero({ label, value, children }: { label: string; value: string | number; children?: ReactNode }) {
  return (
    <section className="pt-6 pb-2 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 flex items-baseline justify-center gap-2">
        <AmountFigure value={value} />
        <span className="text-lg text-muted-foreground">TAZ</span>
      </p>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export const exitTotals = (j: ExitJob) => {
  const total = j.pieces.reduce((s, p) => s + zats(p.amount), 0);
  const sent = j.pieces.filter((p) => p.status === 'sent').reduce((s, p) => s + zats(p.amount), 0);
  const count = j.pieces.filter((p) => p.status === 'sent').length;
  const failed = j.pieces.some((p) => p.status === 'failed');
  const finished = j.pieces.every((p) => p.status === 'sent' || p.status === 'failed');
  return { total, sent, count, failed, finished };
};

export function ExitStatus({ job }: { job: ExitJob }) {
  const { failed, finished } = exitTotals(job);
  if (failed) return <StatusChip tone="danger">Needs attention</StatusChip>;
  if (finished) return <StatusChip tone="success">Complete</StatusChip>;
  return (
    <StatusChip tone="warning" icon={<Clock />}>
      In progress
    </StatusChip>
  );
}

/** Sent against total with a meter and percentage. Shared by the Home card and the Safe exit page. */
export function ExitSummary({ job, hidden, trailing }: { job: ExitJob; hidden?: boolean; trailing?: ReactNode }) {
  const { total, sent, failed } = exitTotals(job);
  const pct = total ? (sent / total) * 100 : 0;
  return (
    <>
      <span className="flex items-start justify-between gap-4">
        <span>
          <span className="caps block">Safe exit sent</span>
          <span className="mt-2 block text-3xl font-medium tracking-tight tabular-nums">{hidden ? HIDDEN : taz(sent / 1e8)}</span>
        </span>
        <span className="text-right">
          <span className="caps block">Total</span>
          <span className="mt-3 block text-xl font-medium tracking-tight tabular-nums">{hidden ? HIDDEN : taz(total / 1e8)}</span>
        </span>
      </span>
      {/* A meter: the track is a faint step of the fill's own colour, so its state reads across the whole bar. */}
      <span className={cn('mt-5 block h-2 overflow-hidden rounded-full', failed ? 'bg-destructive/15' : 'bg-primary/15')} aria-hidden>
        <span className={cn('block h-full rounded-full transition-[width]', failed ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </span>
      <span className="mt-4 flex items-center justify-between gap-3">
        <span className={cn('text-4xl font-medium tracking-tight tabular-nums', failed ? 'text-foreground' : 'text-success')}>{Math.round(pct)}%</span>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <ExitStatus job={job} />
          {trailing}
        </span>
      </span>
    </>
  );
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'brand';

export const toneText: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  neutral: 'text-muted-foreground',
  brand: 'text-primary',
};

export const toneSurface: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
  brand: 'bg-primary/10 text-primary',
};

/** A small status label. Always a word, usually with an icon, so colour is never the only signal. */
export function StatusChip({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3', toneSurface[tone])}>
      {icon}
      {children}
    </span>
  );
}

const levelIcon: Record<Level, ReactNode> = {
  green: <CheckCircle2 />,
  amber: <AlertTriangle />,
  red: <XCircle />,
};

export function LevelChip({ level }: { level: Level }) {
  return (
    <StatusChip tone={LEVEL[level].tone} icon={levelIcon[level]}>
      {LEVEL[level].label}
    </StatusChip>
  );
}

export function AddressTag({ kind }: { kind: 'private' | 'public' }) {
  return kind === 'private' ? (
    <StatusChip tone="success" icon={<ShieldCheck />}>Private</StatusChip>
  ) : (
    <StatusChip tone="warning" icon={<Eye />}>Public</StatusChip>
  );
}

/** Every transaction shows its id and a link to the public explorer, so anything can be verified. */
export function TxLink({ txid, href, className }: { txid: string; href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline', className)}
    >
      {shortAddr(txid, 8, 6)}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">Open on explorer (new tab)</span>
    </a>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/** A dropped connection or server error during a spend doesn't prove the money stayed put. */
export const isUncertainSpend = (error: Error) => {
  const status = error instanceof ApiError ? error.status : 500;
  return status === 0 || status >= 500;
};

/** Turns an API failure into what happened and what to do next, with a way to retry. */
export function ErrorNote({ error, onRetry, retryLabel = 'Try again', spending }: { error: Error; onRetry?: () => void; retryLabel?: string; spending?: boolean }) {
  const status = error instanceof ApiError ? error.status : 500;
  const confirming = status === 409;
  const limited = status === 429;
  // Offering a one-click retry here could pay twice, so send people to check first.
  const uncertain = !!spending && isUncertainSpend(error);
  if (uncertain) onRetry = undefined;
  const tone: Tone = confirming || limited || uncertain ? 'warning' : 'danger';
  const title = uncertain ? 'This may still have gone through' : confirming ? 'Funds still confirming' : limited ? 'Demo limit reached' : status === 0 ? 'No connection' : status === 400 ? 'Check the details' : "That didn't work";
  const body = uncertain
    ? 'Mirage lost track of this transaction. Go back to your wallet and check Activity in a minute or two before sending again, so you don’t pay twice.'
    : confirming
      ? 'Funds unlock after the last transaction is mined, usually within 30–90 seconds. Nothing was sent.'
      : error.message;
  return (
    <div role="alert" className={cn('rounded-3xl p-4 text-sm', tone === 'warning' ? 'bg-warning/[0.07]' : 'bg-destructive/[0.07]')}>
      <div className={cn('flex items-center gap-2 font-medium', toneText[tone])}>
        {confirming ? <Clock className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
        {title}
      </div>
      <p className="mt-1 text-pretty text-foreground/80">{body}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCw />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

const MAX_DOTS = 48;

/** The crowd as a crowd: one dot for each similar crossing, with yours marked. */
export function CrowdDots({ crowd }: { crowd: number }) {
  const shown = Math.min(crowd, MAX_DOTS);
  return (
    <figure className="m-0">
      <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={`Your transaction and ${crowd} similar recent ${crowd === 1 ? 'one' : 'ones'}`}>
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          <span className="size-3 rounded-full bg-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-card" aria-hidden />
          You
        </span>
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="size-2 rounded-full bg-muted-foreground/50" aria-hidden />
        ))}
        {crowd > MAX_DOTS && <span className="text-xs text-muted-foreground">+{crowd - MAX_DOTS}</span>}
      </div>
    </figure>
  );
}

/** The result of the privacy check: the verdict in words, the crowd, and anything it could be matched with. */
export function AssessmentCard({ assessment, amount }: { assessment: Assessment; amount: string }) {
  const { level, crowd, reason, candidates } = assessment;
  const headline = level === 'green' ? 'Safe to send' : level === 'amber' ? 'Only a few look like this' : 'This would stand out';
  return (
    <section className="surface p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight text-balance">{headline}</h2>
        <LevelChip level={level} />
      </div>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">{reason}</p>
      <div className="mt-4">
        <CrowdDots crowd={crowd} />
        <p className="mt-2 text-xs text-muted-foreground">
          {crowd === 0 ? `Nobody else recently moved about ${taz(amount)} TAZ across the pool boundary.` : `${crowd} similar recent ${crowd === 1 ? 'crossing' : 'crossings'} to hide among.`}
        </p>
      </div>
      {level !== 'green' && candidates.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs text-muted-foreground">Anyone could pair your exit with {candidates.length === 1 ? 'this deposit' : 'these deposits'}:</p>
          <ul className="mt-2 space-y-1.5">
            {candidates.slice(0, 3).map((c) => (
              <li key={c.txid} className="flex items-center justify-between gap-3 text-xs">
                <span className="tabular-nums">
                  {taz(c.zats / 1e8)} TAZ <span className="text-muted-foreground">· {ago(c.time)}</span>
                </span>
                {c.explorer && <TxLink txid={c.txid} href={c.explorer} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      <HowItWorks>
        <button type="button" className="mt-4 rounded-sm text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          How Mirage decides
        </button>
      </HowItWorks>
    </section>
  );
}

/** Never lets the page look frozen during the slow proof step. */
export function ProofProgress({ title, hint }: { title: string; hint: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <section className="surface mt-6 p-8 text-center" role="status" aria-live="polite">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
      <h2 className="mt-4 text-lg font-medium tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">{hint}</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="mirage-progress-bar h-full w-2/5 rounded-full bg-primary" />
      </div>
      <p className="mt-2 text-xs tabular-nums text-muted-foreground" aria-hidden>
        {elapsed} s · usually about 20–25 s
      </p>
      <p className="mt-3 text-xs text-muted-foreground">Stay on this page. There's no need to click again.</p>
    </section>
  );
}

const STAGES: { key: TxStage; label: string }[] = [
  { key: 'seen', label: 'Seen' },
  { key: 'mined', label: 'Mined' },
  { key: 'confirmed', label: 'Confirmed' },
];

/** Seen, then mined, then confirmed. Broadcasting a transaction doesn't mean it's done. */
export function StageTrack({ stage }: { stage: TxStage }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="flex items-center gap-2" aria-label={`Status: ${stage}`}>
      {STAGES.map((s, i) => {
        const done = i < current || stage === 'confirmed';
        const active = i === current && stage !== 'confirmed';
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2 text-xs last:flex-none">
            <span className={cn('flex items-center gap-1.5 whitespace-nowrap', done ? 'text-success' : active ? 'text-foreground' : 'text-muted-foreground')}>
              {done ? <CheckCircle2 className="size-3.5" aria-hidden /> : active ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <span className="size-3.5 rounded-full border" aria-hidden />}
              {s.label}
            </span>
            {i < STAGES.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-success/40' : 'bg-border')} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function HowItWorks({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How Mirage decides</DialogTitle>
          <DialogDescription>Mirage checks whether your transaction would be easy to link back to you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-pretty text-foreground/85">
          <p>Inside the private pool, nobody can see who paid whom or how much. The moment money leaves for a public address, its amount and time are visible to everyone.</p>
          <p>If that amount matches a recent deposit, anyone can connect the two. So Mirage counts how many recent transactions look like yours. That number is your <strong className="font-medium text-foreground">crowd</strong>: the bigger it is, the harder you are to pick out.</p>
          <p>If your crowd is too small, Mirage holds the send and offers a <strong className="font-medium text-foreground">safe exit</strong>. It splits the money privately into common amounts, then sends each piece on its own schedule, checking again right before each one leaves.</p>
          <p className="text-muted-foreground">This is an estimate based on amount and timing. It reduces the risk of being linked but can't promise anonymity.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
