import { ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorNote, LevelChip, PageHeader } from '@/components/mirage';
import { api, type Account } from '@/lib/api';
import { ago, taz } from '@/lib/format';
import { usePoll } from '@/lib/hooks';

/** Privacy report card: every past exit from this wallet, re-scored as it looked when it happened. Reads only. */
export default function Report({ account, onBack }: { account: Account; onBack: () => void }) {
  const report = usePoll(() => api.report(account.id), 60_000, [account.id]);
  const r = report.data;
  const score = r?.summary.score;
  const tone = score == null ? 'text-muted-foreground' : score >= 75 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-destructive';
  const ring = score ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-10">
      <PageHeader title="Privacy report" onBack={onBack} />

      {report.error && <ErrorNote error={report.error} onRetry={report.reload} />}

      <section className="surface flex flex-col items-center p-6 text-center">
        <div className="relative size-40">
          <svg viewBox="0 0 120 120" className="size-40 -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/40" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - ring / 100)}
              className={`${tone} transition-[stroke-dashoffset] duration-700`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {r ? <span className={`text-4xl font-medium tabular-nums ${tone}`}>{score ?? '—'}</span> : <Skeleton className="h-9 w-14" />}
            <span className="text-xs text-muted-foreground">out of 100</span>
          </div>
        </div>
        <p className="mt-4 text-lg font-medium tracking-tight">
          {!r ? <Skeleton className="mx-auto h-6 w-56" /> : r.summary.exits === 0
            ? 'No public exits yet'
            : `${r.summary.blended} of ${r.summary.exits} exits blended into a crowd`}
        </p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Every time this wallet sent money out of the private pool, its amount and time became public. This is how easy each one was to link.
        </p>
        {r && r.summary.exits > 0 && (
          <div className="mt-4 grid w-full grid-cols-3 gap-2 text-sm">
            <div className="surface-sm p-2"><p className="text-lg font-medium text-success tabular-nums">{r.summary.blended}</p><p className="text-xs text-muted-foreground">In a crowd</p></div>
            <div className="surface-sm p-2"><p className="text-lg font-medium text-warning tabular-nums">{r.summary.narrow}</p><p className="text-xs text-muted-foreground">Narrow</p></div>
            <div className="surface-sm p-2"><p className="text-lg font-medium text-destructive tabular-nums">{r.summary.linkable}</p><p className="text-xs text-muted-foreground">Linkable</p></div>
          </div>
        )}
      </section>

      {r && r.exits.length > 0 && (
        <section className="space-y-2" aria-label="Past exits">
          <p className="caps px-1">Past exits</p>
          <ul className="space-y-2">
            {r.exits.map((e) => (
              <li key={e.txid} className="surface-sm flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">−{taz(e.amount)} TAZ</span>
                    <LevelChip level={e.level} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ago(e.time)} · crowd of {e.crowd}</p>
                </div>
                <a href={e.explorer} target="_blank" rel="noopener" aria-label="View on explorer" className="text-muted-foreground hover:text-primary [&_svg]:size-4">
                  <ExternalLink />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && (
        <p className="px-1 text-xs text-muted-foreground">
          Score: crowd exits count fully, narrow ones half, linkable ones zero. Checked against public crossings in blocks {r.summary.indexedFrom.toLocaleString('en-US')}–{r.summary.indexedTo.toLocaleString('en-US')}. Amount and timing only.
        </p>
      )}
    </div>
  );
}
