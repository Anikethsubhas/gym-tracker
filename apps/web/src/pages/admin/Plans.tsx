import { useState, type FormEvent } from 'react';
import { Check, Layers, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { PlanWithCount } from '@gym/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { formatINR, planLength } from '@/lib/format';
import { usePlans, useSavePlan } from '@/lib/queries';
import { cn } from '@/lib/utils';

function PlanDialog({ plan, onClose }: { plan: PlanWithCount | null; onClose: () => void }) {
  const save = useSavePlan(plan?.id);
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan ? String(plan.price) : '');
  const [months, setMonths] = useState(plan ? String(plan.duration_months) : '1');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [features, setFeatures] = useState((plan?.features ?? []).join('\n'));
  const [featured, setFeatured] = useState(plan?.is_featured ?? false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        name, price: Number(price), duration_months: Number(months), description: description || null,
        features: features.split('\n').map((f) => f.trim()).filter(Boolean), is_featured: featured,
      });
      toast.success(`${name} saved.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
          <DialogDescription>Active plans are listed on your landing page.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input id="plan-name" required autoFocus maxLength={60} placeholder="Monthly" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="plan-price">Price (₹)</Label>
              <Input id="plan-price" type="number" min="0" step="any" required value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan-months">Length (months)</Label>
              <Input id="plan-months" type="number" min="1" max="36" step="1" required value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plan-desc">Description (optional)</Label>
            <Input id="plan-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="plan-features">What is included (optional)</Label>
            <Textarea id="plan-features" rows={4} placeholder={'Full gym access\nGroup classes\nLocker'} value={features} onChange={(e) => setFeatures(e.target.value)} />
            <p className="text-sm text-muted-foreground">One per line. Shown as ticks on the landing page.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="plan-featured" className="cursor-pointer">Mark as most popular</Label>
            <Switch id="plan-featured" checked={featured} onCheckedChange={setFeatured} />
          </div>
          {plan && <p className="text-sm text-muted-foreground">Changing the price affects future payments only. Past payments keep what was actually paid.</p>}
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Plans() {
  const { data: plans, isPending, error } = usePlans();
  const [editing, setEditing] = useState<PlanWithCount | 'new' | null>(null);
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const archive = useSavePlan(archiveId ?? undefined);

  async function toggle(plan: PlanWithCount) {
    setArchiveId(plan.id);
    try {
      await archive.mutateAsync({
        name: plan.name, price: plan.price, duration_months: plan.duration_months,
        description: plan.description, is_active: !plan.is_active,
      });
      toast.success(plan.is_active ? `${plan.name} archived. New members can't pick it.` : `${plan.name} is available again.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the plan.');
    }
  }

  return (
    <>
      <PageHeader
        title="Plans"
        description="The membership options you can assign to members."
        actions={<Button onClick={() => setEditing('new')}><Plus aria-hidden /> New plan</Button>}
      />

      {error ? (
        <p role="alert" className="text-destructive">{error.message}</p>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : plans.length === 0 ? (
        <Card><EmptyState icon={Layers} title="No plans yet">Create your first plan, then assign it to members.</EmptyState></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className={cn('flex flex-col', !p.is_active && 'opacity-70')}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <CardTitle>{p.name}</CardTitle>
                <div className="flex gap-1">
                  {p.is_featured && <Badge variant="success">Most popular</Badge>}
                  {!p.is_active && <Badge variant="muted">Archived</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="font-display text-4xl font-bold tabular-nums">{formatINR(p.price)}</p>
                <p className="text-sm text-muted-foreground">for {planLength(p.duration_months)}</p>
                {p.description && <p className="mt-3 text-sm">{p.description}</p>}
                {p.features.length > 0 && (
                  <ul className="mt-3 grid gap-1 text-sm">
                    {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-status-paid" aria-hidden />{f}</li>)}
                  </ul>
                )}
                <p className="mt-3 text-sm text-muted-foreground">{p.member_count} active member{p.member_count === 1 ? '' : 's'}</p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil aria-hidden /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.is_active ? 'Archive' : 'Restore'}</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {editing && <PlanDialog plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
