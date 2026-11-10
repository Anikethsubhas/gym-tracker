import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { OfferAdmin, OfferStatus } from '@gym/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { formatValidity } from '@/lib/format';
import { useDeleteOffer, useOffers, useSaveOffer } from '@/lib/queries';

const STATUS: Record<OfferStatus, { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  live: { label: 'Live', variant: 'success' },
  scheduled: { label: 'Starts later', variant: 'warning' },
  hidden: { label: 'Hidden', variant: 'muted' },
  expired: { label: 'Ended', variant: 'muted' },
};

function OfferDialog({ offer, onClose }: { offer: OfferAdmin | null; onClose: () => void }) {
  const save = useSaveOffer(offer?.id);
  const [title, setTitle] = useState(offer?.title ?? '');
  const [highlight, setHighlight] = useState(offer?.highlight ?? '');
  const [description, setDescription] = useState(offer?.description ?? '');
  const [code, setCode] = useState(offer?.code ?? '');
  const [from, setFrom] = useState(offer?.valid_from ?? '');
  const [until, setUntil] = useState(offer?.valid_until ?? '');
  const [active, setActive] = useState(offer?.is_active ?? true);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        title, highlight: highlight || null, description: description || null, code: code || null,
        valid_from: from || null, valid_until: until || null, is_active: active,
      });
      toast.success(`${title} saved.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the offer.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{offer ? 'Edit offer' : 'New offer'}</DialogTitle>
          <DialogDescription>Shown on your landing page and in every member's app while it is live.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="offer-title">Title</Label>
            <Input id="offer-title" required autoFocus maxLength={80} placeholder="New year offer" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="offer-highlight">Headline (optional)</Label>
            <Input id="offer-highlight" maxLength={30} placeholder="20% off" value={highlight} onChange={(e) => setHighlight(e.target.value)} />
            <p className="text-sm text-muted-foreground">The big text on the offer ticket.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="offer-desc">Details (optional)</Label>
            <Textarea id="offer-desc" rows={3} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="offer-code">Code to quote at the desk (optional)</Label>
            <Input id="offer-code" maxLength={30} placeholder="NY20" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="offer-from">Starts (optional)</Label>
              <Input id="offer-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="offer-until">Ends (optional)</Label>
              <Input id="offer-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="offer-active" className="cursor-pointer">Show this offer</Label>
            <Switch id="offer-active" checked={active} onCheckedChange={setActive} />
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : offer ? 'Save changes' : 'Create offer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Offers() {
  const { data: offers, isPending, error } = useOffers();
  const remove = useDeleteOffer();
  const [editing, setEditing] = useState<OfferAdmin | 'new' | null>(null);
  const [deleting, setDeleting] = useState<OfferAdmin | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Offer deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the offer.');
    }
  }

  return (
    <>
      <PageHeader
        title="Offers"
        description="Deals shown on your landing page and in every member's app."
        actions={<Button onClick={() => setEditing('new')}><Plus aria-hidden /> New offer</Button>}
      />
      <Card>
        {error ? (
          <p role="alert" className="p-5 text-destructive">{error.message}</p>
        ) : isPending ? (
          <div className="grid gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : offers.length === 0 ? (
          <EmptyState icon={Tag} title="No offers yet">Create an offer and it appears on your landing page straight away.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Offer</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-semibold">{o.title}{o.highlight && <span className="ml-2 font-normal text-muted-foreground">{o.highlight}</span>}</div>
                    {o.code && <div className="text-xs text-muted-foreground">Code {o.code}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatValidity(o.valid_from, o.valid_until) || 'No dates set'}</TableCell>
                  <TableCell><Badge variant={STATUS[o.status].variant}>{STATUS[o.status].label}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(o)}><Pencil aria-hidden /> Edit</Button>{' '}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(o)} aria-label={`Delete ${o.title}`}><Trash2 aria-hidden /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && <OfferDialog offer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ''}"?`}
        description="It disappears from your landing page and from every member's app. To hide it for a while instead, edit it and switch off Show this offer."
        confirmLabel="Delete offer"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
