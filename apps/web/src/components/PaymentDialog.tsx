import { useState, type FormEvent } from 'react';
import { addMonths, laterDate, PAYMENT_METHODS, type MemberOverview, type PaymentMethod } from '@gym/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CalendarCheck } from 'lucide-react';
import { useRecordPayment } from '@/lib/queries';
import { formatDate, formatINR, planLength, todayIso } from '@/lib/format';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };

export function PaymentDialog({ member, onClose }: { member: MemberOverview; onClose: () => void }) {
  const record = useRecordPayment(member.id);
  const today = todayIso();
  const [amount, setAmount] = useState(String(member.plan_price));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const newDue = addMonths(laterDate(member.next_due_date, paidOn), member.duration_months);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await record.mutateAsync({ amount: Number(amount), method, paid_on: paidOn, note: note || null });
      toast.success(`Payment saved for ${member.name}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the payment.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>{member.name}, {member.plan_name} ({formatINR(member.plan_price)} for {planLength(member.duration_months)})</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="pay-amount">Amount received (₹)</Label>
            <Input
              id="pay-amount"
              type="number"
              min="1"
              step="any"
              inputMode="decimal"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">Paid by</legend>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="grid grid-cols-4 gap-2" aria-label="Paid by">
              {PAYMENT_METHODS.map((m) => (
                <div key={m}>
                  <RadioGroupItem value={m} id={`method-${m}`} className="peer sr-only" />
                  <Label
                    htmlFor={`method-${m}`}
                    className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-card text-sm font-medium transition-colors hover:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                  >
                    {METHOD_LABEL[m]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="pay-date">Payment date</Label>
            <Input
              id="pay-date"
              type="date"
              max={today}
              required
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-note">Note (optional)</Label>
            <Input
              id="pay-note"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <p className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
            <CalendarCheck className="size-4 shrink-0" aria-hidden />
            <span>Membership will run until <strong>{formatDate(newDue)}</strong>. That is the next due date.</span>
          </p>

          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={record.isPending}>{record.isPending ? 'Saving…' : 'Save payment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
