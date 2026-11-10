import { useState, type FormEvent } from 'react';
import { PAYMENT_METHODS, type MemberOverview, type PaymentMethod } from '@gym/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateMember, usePlans, useUpdateMember } from '@/lib/queries';
import { formatINR, formatPhone, planLength, todayIso } from '@/lib/format';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };

interface Props {
  /** Pass a member to edit them; leave out to add a new one. */
  member?: MemberOverview;
  onClose: () => void;
  onCreated?: (member: MemberOverview) => void;
}

export function MemberDialog({ member, onClose, onCreated }: Props) {
  const editing = Boolean(member);
  const plans = usePlans();
  const activePlans = (plans.data ?? []).filter((p) => p.is_active);
  const create = useCreateMember();
  const update = useUpdateMember(member?.id ?? 0);

  const [name, setName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member ? formatPhone(member.phone) : '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [notes, setNotes] = useState(member?.notes ?? '');
  const [planChoice, setPlanChoice] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [paidNow, setPaidNow] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountEdit, setAmountEdit] = useState<string | null>(null);
  const [error, setError] = useState('');

  const planId = planChoice ?? String(activePlans[0]?.id ?? '');
  const plan = activePlans.find((p) => String(p.id) === planId);
  const amount = amountEdit ?? String(plan?.price ?? '');
  const busy = create.isPending || update.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const base = { name, phone, email: email || null, notes: notes || null };
    try {
      if (member) {
        await update.mutateAsync(base);
        toast.success('Changes saved.');
      } else {
        const created = await create.mutateAsync({
          ...base,
          plan_id: Number(planId),
          start_date: startDate,
          first_payment: paidNow ? { paid: true, amount: Number(amount), method } : { paid: false },
        });
        toast.success(`${created.name} added.`);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit member' : 'Add member'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-phone">Mobile number</Label>
            <Input id="m-phone" required inputMode="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="text-sm text-muted-foreground">Reminders go to this number on SMS and WhatsApp.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-email">Email (optional)</Label>
            <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {!editing && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="m-plan">Plan</Label>
                <Select
                  value={planId}
                  onValueChange={(value) => {
                    setPlanChoice(value);
                    setAmountEdit(null);
                  }}
                >
                  <SelectTrigger id="m-plan"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                  <SelectContent>
                    {activePlans.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} · {formatINR(p.price)} for {planLength(p.duration_months)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="m-start">Membership starts</Label>
                <Input id="m-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox id="m-paid" checked={paidNow} onCheckedChange={(v) => setPaidNow(v === true)} />
                <Label htmlFor="m-paid" className="cursor-pointer">First payment collected</Label>
              </div>
              {paidNow ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="m-amount">Amount (₹)</Label>
                    <Input id="m-amount" type="number" min="1" step="any" required value={amount} onChange={(e) => setAmountEdit(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="m-method">Paid by</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                      <SelectTrigger id="m-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABEL[m]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                  Not paid yet, so the first payment{plan ? ` of ${formatINR(plan.price)}` : ''} is due on the start date.
                </p>
              )}
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="m-notes">Notes (optional)</Label>
            <Textarea id="m-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || (!editing && !planId)}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
