import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddressTag, BottomAction, PageHeader } from '@/components/mirage';
import type { Account } from '@/lib/api';

/** Copies the address without showing it. The eye inside the button reveals it, and it starts hidden. */
export default function Receive({ account, onBack }: { account: Account; onBack: () => void }) {
  const address = account.address;
  const [visible, setVisible] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copy !== 'copied') return;
    const t = window.setTimeout(() => setCopy('idle'), 1500);
    return () => window.clearTimeout(t);
  }, [copy]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopy('copied');
    } catch {
      // Some browsers block clipboard access. Show the address so it can still be copied by hand.
      setCopy('failed');
      setVisible(true);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Receive" onBack={onBack} />

      <div className="flex flex-1 flex-col">
        {/* Takes the space between the header and the button, so the QR code sits in the middle of the page. */}
        <section aria-labelledby="receive-wallet" className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
          <div className="rounded-3xl bg-foreground p-4">
            <QRCodeSVG value={address} size={216} level="L" bgColor="#e8e6e1" fgColor="#171614" title={`QR code for the ${account.name} address`} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <h2 id="receive-wallet" className="text-xl font-medium tracking-tight">
                {account.name}
              </h2>
              <AddressTag kind="private" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-foreground">Scan this code to pay this wallet.</p>
              <p className="text-sm text-pretty text-muted-foreground">The amount, sender and message stay private.</p>
            </div>
          </div>

          {copy === 'failed' && <p className="text-xs text-warning">Your browser blocked copying. Select the address below to copy it.</p>}

          {visible && (
            <p id="wallet-address" className="w-full rounded-2xl bg-muted p-4 text-left font-mono text-xs break-all text-muted-foreground select-all">
              {address}
            </p>
          )}
        </section>

        <BottomAction>
          {/* Two sibling buttons styled as one, because a button can't validly contain another button. */}
          <div className="relative">
            <Button size="lg" className="action h-14 w-full px-14" onClick={() => void copyAddress()}>
              {copy === 'copied' ? <Check /> : <Copy />}
              <span aria-live="polite">{copy === 'copied' ? 'Copied' : 'Copy address'}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2.5 right-2.5 rounded-full text-primary-foreground hover:bg-black/10 hover:text-primary-foreground focus-visible:ring-primary-foreground/60 dark:hover:bg-black/10"
              aria-label={visible ? 'Hide address' : 'Show address'}
              aria-expanded={visible}
              aria-controls="wallet-address"
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <Eye /> : <EyeOff />}
            </Button>
          </div>
        </BottomAction>
      </div>
    </div>
  );
}
