import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AssessmentCard, BottomAction, ErrorNote, PageHeader } from '@/components/mirage';
import { type Assessment } from '@/lib/api';
import { checkPrivately } from '@/lib/private-check';

/** Scores an amount without sending anything, entirely in the browser (see lib/private-check.ts). */
export default function Check({ onBack, onSend }: { onBack: () => void; onSend: () => void }) {
  const [amount, setAmount] = useState('');
  const [checked, setChecked] = useState<{ amount: string; result: Assessment; indexed: number }>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const valid = /^\d*\.?\d{0,8}$/.test(amount.trim()) && Number(amount) > 0;

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const value = amount.trim();
      const result = await checkPrivately(value);
      setChecked({ amount: value, result, indexed: result.indexed });
    } catch (err) {
      setChecked(undefined);
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Check privacy" onBack={onBack} />

      <form className="flex flex-1 flex-col gap-6" onSubmit={(e) => void run(e)}>
        <section className="pt-6 text-center">
          <Label htmlFor="check-amount" className="justify-center font-normal text-muted-foreground">
            How much would leave the private pool?
          </Label>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <Input
              id="check-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              style={{ fontSize: '3.5rem', width: `${Math.max(amount.length, 4) * 0.56 + 0.1}em` }}
              className="amount-field h-16 max-w-[75%] rounded-none border-0 bg-transparent p-0 text-center leading-none font-medium tracking-tight tabular-nums caret-primary shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0 dark:bg-transparent"
            />
            <span className="text-lg text-muted-foreground">TAZ</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">This only checks. Nothing is sent, and the amount never leaves this device.</p>
        </section>

        {error && <ErrorNote error={error} onRetry={() => void run()} />}

        {checked && <AssessmentCard assessment={checked.result} amount={checked.amount} />}
        {checked && (
          <p className="text-center text-xs text-muted-foreground">
            🔒 Checked in your browser against {checked.indexed} public crossings. Mirage's server never saw this amount.
          </p>
        )}

        <BottomAction>
          <div className="space-y-2">
            <Button type="submit" size="lg" className="action h-14 w-full" disabled={!valid || busy}>
              {busy && <Loader2 className="animate-spin" />}
              {busy ? 'Checking…' : 'Check privacy'}
            </Button>
            {checked && (
              <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={onSend}>
                Go to Send
              </Button>
            )}
          </div>
        </BottomAction>
      </form>
    </div>
  );
}
