import { useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardPaste, Eye, EyeOff, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AddressTag, AmountHero, AssessmentCard, BottomAction, ErrorNote, HIDDEN, isUncertainSpend, PageHeader, ProofProgress, Row, StageTrack, TxLink } from '@/components/mirage';
import { api, type Account, type Assessment, type Proposal } from '@/lib/api';
import { about, addressKind, CONFIRMATIONS, privateZats, shortAddr, taz, zats, type TxStage } from '@/lib/format';
import { usePoll } from '@/lib/hooks';

type Step =
  | { name: 'form' }
  | { name: 'review'; assessment?: Assessment }
  | { name: 'held'; assessment: Assessment; proposal: Proposal }
  | { name: 'working'; title: string; hint: string }
  | { name: 'done'; txid: string; explorer: string; kind: 'private' | 'public' | 'forced' };

const FEE: Record<'private' | 'public', string> = { private: '0.0001', public: '0.00015' };
const MEMO_LIMIT = 512;

export default function Send({ account, onExit, onOpenExit }: { account: Account; onExit: () => void; onOpenExit: (id: string) => void }) {
  const wallet = usePoll(() => api.wallet(account.id), null, [account.id]);
  const health = usePoll(() => api.health(), null, []);
  const [step, setStep] = useState<Step>({ name: 'form' });
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<{ err: Error; retry?: () => void }>();
  const [hidden, setHidden] = useState(() => localStorage.getItem('mirage.hideAmounts') === '1');

  const kind = addressKind(address);
  const dest = address.trim();
  const cap = health.data?.limits.maxPerRequestZec ?? 0.1;
  const available = wallet.data ? privateZats(wallet.data.balance) : null;
  const memoBytes = new TextEncoder().encode(memo).length;

  const amountZats = /^\d*\.?\d{0,8}$/.test(amount.trim()) ? zats(amount || 0) : NaN;
  const amountError = !amount.trim()
    ? undefined
    : Number.isNaN(amountZats) || amountZats <= 0
      ? 'Enter an amount above 0, with up to 8 decimals.'
      : amountZats > zats(cap)
        ? `This demo sends up to ${cap} TAZ at a time.`
        : available !== null && amountZats > available
          ? `You have ${taz(available / 1e8)} TAZ available.`
          : undefined;
  const addressError = kind === 'invalid' ? 'This isn’t a testnet address. It should start with utest1, ztestsapling, tm or texs.' : undefined;
  const memoError = memoBytes > MEMO_LIMIT ? 'Messages can be up to 512 bytes. Please shorten it.' : undefined;
  const canContinue = kind !== 'empty' && !addressError && amount.trim() !== '' && !amountError && !memoError && !checking;

  const toggleHidden = () => {
    setHidden((h) => {
      localStorage.setItem('mirage.hideAmounts', h ? '0' : '1');
      return !h;
    });
  };

  const fail = (err: unknown, back: Step, retry?: () => void) => {
    setError({ err: err as Error, retry });
    setStep(back);
  };

  /** Nothing has been spent up to the end of this function, unless the exit became safe at the last moment. */
  async function checkAndContinue() {
    setError(undefined);
    if (kind === 'private') return setStep({ name: 'review' });
    setChecking(true);
    try {
      const assessment = await api.assess(amount);
      if (assessment.level === 'green') return setStep({ name: 'review', assessment });
      // The API has no separate call for the split plan. /api/send returns it for amber and red without spending.
      const r = await api.send({ account: account.id, address: dest, amount });
      if (r.sent) setStep({ name: 'done', txid: r.txid, explorer: r.explorer, kind: 'public' });
      else setStep({ name: 'held', assessment: r.assessment, proposal: r.proposal });
    } catch (e) {
      fail(e, { name: 'form' }, () => void checkAndContinue());
    } finally {
      setChecking(false);
    }
  }

  async function sendNow(force = false) {
    const back = step;
    setError(undefined);
    setStep({
      name: 'working',
      title: kind === 'private' ? 'Building a private proof' : 'Preparing your transaction',
      hint: 'Your wallet is doing the cryptography that makes this transaction valid.',
    });
    try {
      const r = await api.send({ account: account.id, address: dest, amount, memo: kind === 'private' && memo ? memo : undefined, force: force || undefined });
      if (r.sent) setStep({ name: 'done', txid: r.txid, explorer: r.explorer, kind: force ? 'forced' : kind === 'private' ? 'private' : 'public' });
      else setStep({ name: 'held', assessment: r.assessment, proposal: r.proposal });
    } catch (e) {
      fail(e, back);
    }
  }

  async function runSafeExit() {
    const back = step;
    setError(undefined);
    setStep({ name: 'working', title: 'Splitting your funds privately', hint: 'One private transaction divides this amount inside the pool. Nothing is public yet.' });
    try {
      const { job } = await api.guardedExit({ account: account.id, address: dest, amount });
      onOpenExit(job.id);
    } catch (e) {
      fail(e, back);
    }
  }

  const backTarget =
    step.name === 'review' || step.name === 'held'
      ? () => {
          setError(undefined);
          setStep({ name: 'form' });
        }
      : step.name === 'form'
        ? onExit
        : undefined;
  const title = step.name === 'form' ? 'Send' : step.name === 'review' ? 'Review' : step.name === 'held' ? 'Held for your privacy' : step.name === 'done' ? 'Sent to the network' : 'Sending';

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={title}
        hideTitle={step.name === 'form'}
        onBack={backTarget}
        backLabel="Back"
        trailing={
          step.name === 'form' && (
            <button
              type="button"
              onClick={toggleHidden}
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
              aria-pressed={hidden}
              className="flex size-11 items-center justify-center rounded-full text-foreground/85 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {hidden ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          )
        }
      />

      {step.name === 'form' && (
        <form
          className="flex flex-1 flex-col gap-5"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (canContinue) void checkAndContinue();
          }}
        >
          <AvailableBalance available={available} hidden={hidden} />

          <div className="space-y-2">
            <div className="flex h-6 items-center justify-between">
              <Label htmlFor="to" className="font-normal">
                Send to
              </Label>
              {(kind === 'private' || kind === 'public') && <AddressTag kind={kind} />}
            </div>
            <div className="relative">
              <Input
                id="to"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Zcash testnet address"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!addressError}
                aria-describedby="to-help"
                className={`field h-14 rounded-2xl pr-14 pl-4 text-sm ${address ? 'font-mono' : ''}`}
              />
              {address ? (
                <button
                  type="button"
                  aria-label="Clear address"
                  onClick={() => {
                    setAddress('');
                    document.getElementById('to')?.focus();
                  }}
                  className="surface-sm absolute top-2 right-2 flex size-10 items-center justify-center rounded-xl text-foreground/85 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : (
                navigator.clipboard?.readText && (
                  <button
                    type="button"
                    aria-label="Paste address"
                    onClick={async () => {
                      try {
                        setAddress((await navigator.clipboard.readText()).trim());
                      } catch {
                        document.getElementById('to')?.focus();
                      }
                    }}
                    className="surface-sm absolute top-2 right-2 flex size-10 items-center justify-center rounded-xl text-foreground/85 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ClipboardPaste className="size-4" aria-hidden />
                  </button>
                )
              )}
            </div>
            {(addressError || kind === 'private' || kind === 'public') && (
              <p id="to-help" className={addressError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {addressError ?? (kind === 'private' ? 'Nobody will see the amount, sender, receiver or message.' : 'The amount and time will be public. Mirage checks it before anything leaves.')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="font-normal">
              Amount
            </Label>
            <div className="relative">
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00 TAZ"
                aria-invalid={!!amountError}
                aria-describedby="amount-help"
                className="field h-14 rounded-2xl pr-20 pl-4 text-base tabular-nums"
              />
              <button
                type="button"
                disabled={available === null}
                // Leaves room for the fee (at most 0.00025 TAZ seen on testnet) and respects the per-send cap.
                onClick={() => available !== null && setAmount(String(Math.max(0, Math.min(available - zats('0.0003'), zats(cap))) / 1e8))}
                className="surface-sm absolute top-2 right-2 flex h-10 items-center justify-center rounded-xl px-3 text-sm text-foreground/85 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
              >
                Max
              </button>
            </div>
            <p id="amount-help" className={amountError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {amountError ?? `Up to ${cap} TAZ per send in this demo.`}
            </p>
          </div>

          {/* Public transactions can't carry a message, so the field only appears when it would work. */}
          {kind !== 'public' && (
            <div className="space-y-2">
              <Label htmlFor="memo" className="font-normal">
                Message
              </Label>
              <Textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} placeholder="Write encrypted message here…" aria-invalid={!!memoError} aria-describedby="memo-help" className="field min-h-28 resize-none rounded-2xl p-4" />
              <p id="memo-help" className={memoError ? 'text-right text-xs text-destructive' : 'text-right text-xs text-muted-foreground tabular-nums'}>
                {memoError ?? `${MEMO_LIMIT - memoBytes}/${MEMO_LIMIT}`}
              </p>
            </div>
          )}

          {error && <ErrorNote error={error.err} onRetry={error.retry} />}

          <BottomAction>
            <Button type="submit" size="lg" className="action h-14 w-full" disabled={!canContinue}>
              {checking && <Loader2 className="animate-spin" />}
              {checking ? 'Checking privacy…' : 'Review'}
            </Button>
          </BottomAction>
        </form>
      )}

      {step.name === 'review' && (
        <div className="flex flex-1 flex-col gap-6">
          <AmountHero label="You're sending" value={amount} />
          {step.assessment && <AssessmentCard assessment={step.assessment} amount={amount} />}
          <dl className="surface divide-y px-5 py-1.5">
            <Row label="From">{account.name}</Row>
            <Row label="To">
              <span className="font-mono text-xs">{shortAddr(dest)}</span>
            </Row>
            <Row label="Network fee">
              <span className="tabular-nums">about {FEE[kind === 'private' ? 'private' : 'public']} TAZ</span>
            </Row>
            {kind === 'private' && memo && (
              <Row label="Message">
                <span className="wrap-anywhere whitespace-pre-wrap">{memo}</span>
              </Row>
            )}
          </dl>
          <WhoSees kind={kind === 'private' ? 'private' : 'public'} />
          {error && <ErrorNote spending error={error.err} onRetry={() => void sendNow()} />}
          <BottomAction>
            {/* If the last attempt may have gone through, don't offer another send. */}
            {error && isUncertainSpend(error.err) ? (
              <Button size="lg" variant="outline" className="action h-14 w-full" onClick={onExit}>
                Back to wallet
              </Button>
            ) : (
              <Button size="lg" className="action h-14 w-full" onClick={() => void sendNow()}>
                {kind === 'private' ? 'Send privately' : 'Send publicly'} · {taz(amount)} TAZ
              </Button>
            )}
          </BottomAction>
        </div>
      )}

      {step.name === 'held' && (
        <div className="flex flex-1 flex-col gap-6">
          <AmountHero label="Not sent yet" value={amount}>
            <p className="mx-auto max-w-xs text-sm text-pretty text-muted-foreground">Here's what Mirage found, and a safer way to send it.</p>
          </AmountHero>
          <AssessmentCard assessment={step.assessment} amount={amount} />

          <section className="surface p-5">
            <h2 className="caps">The safe exit</h2>
            <ol className="mt-4 space-y-3 text-sm">
              <li className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="text-muted-foreground">Now</span> · Split privately
                </span>
                <span className="text-xs text-success">Hidden</span>
              </li>
              {step.proposal.pieces.map((p, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 tabular-nums">
                  <span>
                    <span className="text-muted-foreground">In {about(p.delaySecs)}</span> · {taz(p.amount)} TAZ
                  </span>
                  <span className="text-xs text-muted-foreground">Public</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t pt-4 text-xs text-pretty text-muted-foreground">
              Each piece is checked again right before it leaves, and waits if it would still stand out.
              {zats(step.proposal.remainderStaysShielded) > 0 && ` ${taz(step.proposal.remainderStaysShielded)} TAZ doesn't fit a common amount, so it stays private in your wallet.`} Each step pays a small network fee.
            </p>
          </section>

          {error && <ErrorNote spending error={error.err} onRetry={() => void runSafeExit()} />}

          <BottomAction>
            {/* The safe choice is the big yellow button. Sending anyway is deliberately quieter and asks again. */}
            {error && isUncertainSpend(error.err) ? (
              <Button size="lg" variant="outline" className="action h-14 w-full" onClick={onExit}>
                Back to wallet
              </Button>
            ) : (
              <div className="space-y-1">
                <Button size="lg" className="action h-14 w-full" onClick={() => void runSafeExit()}>
                  Send safely in {step.proposal.pieces.length} {step.proposal.pieces.length === 1 ? 'piece' : 'pieces'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-muted-foreground">
                      Send anyway
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send {taz(amount)} TAZ in one public transaction?</AlertDialogTitle>
                      <AlertDialogDescription>Anyone could see this amount and time, and may be able to link it back to your deposit. This can't be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    {/* The footer stacks in reverse on phones, so the safe choice ends up on top. */}
                    <AlertDialogFooter>
                      <AlertDialogAction variant="outline" className="text-destructive hover:text-destructive" onClick={() => void sendNow(true)}>
                        Send anyway
                      </AlertDialogAction>
                      <AlertDialogCancel variant="default" className="hover:text-primary-foreground">Keep it private</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </BottomAction>
        </div>
      )}

      {step.name === 'working' && <ProofProgress title={step.title} hint={step.hint} />}

      {step.name === 'done' && <Done account={account} amount={amount} step={step} onExit={onExit} />}
    </div>
  );
}

/** Two decimals large and the rest small beside the unit, as a compact reminder of what's available. */
function AvailableBalance({ available, hidden }: { available: number | null; hidden: boolean }) {
  if (available === null) return <Skeleton className="mx-auto my-4 h-16 w-48 rounded-2xl" />;
  const [int, dec] = taz(available / 1e8).split('.');
  return (
    <section aria-label="Available balance" className="pt-2 pb-3 text-center">
      <p className="text-sm text-muted-foreground">Available</p>
      {hidden ? (
        <p className="mt-2 text-[3.5rem] leading-none font-medium tracking-tight">{HIDDEN}</p>
      ) : (
        <p className="mt-2 flex items-baseline justify-center tabular-nums">
          <span className="text-[3.5rem] leading-none font-medium tracking-tight">
            {int}.{dec.slice(0, 2)}
          </span>
          <span className="ml-0.5 text-sm font-medium">
            {dec.slice(2)} TAZ
          </span>
        </p>
      )}
    </section>
  );
}

function WhoSees({ kind }: { kind: 'private' | 'public' }) {
  return kind === 'private' ? (
    <p className="flex gap-3 rounded-3xl bg-success/[0.07] p-4 text-sm text-pretty">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <span>
        <strong className="font-medium">Who can see this:</strong> only you and the receiver. The amount, both parties and the message stay hidden.
      </span>
    </p>
  ) : (
    <p className="flex gap-3 rounded-3xl bg-warning/[0.07] p-4 text-sm text-pretty">
      <Eye className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>
        <strong className="font-medium">Who can see this:</strong> everyone can see the amount, the time and the receiving address. Your private balance and history stay hidden.
      </span>
    </p>
  );
}

function Done({ account, amount, step, onExit }: { account: Account; amount: string; step: Extract<Step, { name: 'done' }>; onExit: () => void }) {
  const activity = usePoll(() => api.activity(account.id), 15_000, [account.id]);
  const health = usePoll(() => api.health(), 15_000, []);
  const tx = activity.data?.find((t) => t.txid === step.txid);
  const height = tx?.height ?? 0;
  const tip = health.data?.toHeight ?? 0;
  const stage: TxStage = height && tip - height >= CONFIRMATIONS ? 'confirmed' : height ? 'mined' : 'seen';
  const headline = stage === 'confirmed' ? 'Sent' : stage === 'mined' ? 'Almost there' : 'On its way';
  return (
    <div className="flex flex-1 flex-col gap-6">
      <AmountHero label={headline} value={amount}>
        <p className="mx-auto max-w-xs text-sm text-pretty text-muted-foreground">
          {step.kind === 'private' ? 'The amount, both parties and any message are hidden on the chain.' : step.kind === 'forced' ? 'Sent in one public transaction, as you chose. The amount and time are visible to everyone.' : 'Sent publicly. The amount and time are visible, and they blend in with similar transactions.'}
        </p>
      </AmountHero>
      <section className="surface p-5" aria-live="polite">
        <div className="flex items-center gap-2">
          {stage === 'confirmed' ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          <h2 className="caps">Status</h2>
        </div>
        <div className="mt-4">
          <StageTrack stage={stage} />
        </div>
        <dl className="mt-4 border-t pt-1.5">
          <Row label="Transaction">
            <TxLink txid={step.txid} href={step.explorer} />
          </Row>
        </dl>
      </section>
      <BottomAction>
        <Button size="lg" variant="outline" className="action h-14 w-full" onClick={onExit}>
          Back to wallet
        </Button>
      </BottomAction>
    </div>
  );
}
