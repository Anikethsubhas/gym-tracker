import { useState, type FormEvent } from 'react';
import { Pencil, Play } from 'lucide-react';
import { toast } from 'sonner';
import type { SubscriptionStatus } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePatchSubscription } from '@/lib/queries';
import { formatDate, todayIso } from '@/lib/format';

interface ResumeDialogProps {
  memberId: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Resume a paused/cancelled membership.
 * Extracted to separate component to prevent remount on parent renders.
 */
export function ResumeDialog({ memberId, isOpen, onClose }: ResumeDialogProps) {
  const patch = usePatchSubscription(memberId);
  const [due, setDue] = useState(todayIso());
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await patch.mutateAsync({ status: 'active', next_due_date: due });
      toast.success('Membership resumed.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume.');
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resume membership</DialogTitle>
          <DialogDescription>
            Reminders restart from the date you choose. A date in the past triggers missed-payment alerts at the next daily check.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="resume-due">Next payment due on</Label>
            <Input id="resume-due" type="date" required value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={patch.isPending}>{patch.isPending ? 'Resuming…' : 'Resume'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}