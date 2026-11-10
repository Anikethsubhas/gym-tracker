import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BellRing, KeyRound, MoreHorizontal, Pause, Pencil, Play, Trash2, UserX, Wallet, MessageSquare, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import type { Payment, PaymentMethod } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { InviteDialog } from '@/components/InviteDialog';
import { MemberAvatar } from '@/components/MemberAvatar';
import { MemberDialog } from '@/components/MemberDialog';
import { PageHeader } from '@/components/PageHeader';
import { PaymentDialog } from '@/components/PaymentDialog';
import { ResumeDialog } from '@/components/ResumeDialog';
import { StatusBadge, dueText } from '@/components/StatusBadge';
import { useRemindMember } from '@/hooks/use-remind-member';
import { formatDate, formatINR, formatPhone, planLength } from '@/lib/format';
import { useDeleteMember, useMember, usePatchSubscription, usePlans, useUndoPayment } from '@/lib/queries';
import { NotificationTable } from '@/components/NotificationTable';

const ACCESS_TEXT = {
  active: 'Signed up and can sign in',
  invited: 'Invited, waiting for them to set a password',
  not_invited: 'Not invited yet',
} as const;

const METHOD: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };

type Modal = null | 'pay' | 'edit' | 'resume' | 'invite';
type Confirm = null | 'cancel' | 'delete' | { undo: Payment };

export default function MemberDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data, isPending, error } = useMember(id);
  const plans = usePlans();
  const patch = usePatchSubscription(id);
  const undo = useUndoPayment(id);
  const del = useDeleteMember(id);
  const remind = useRemindMember();
  const [modal, setModal] = useState<Modal>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  if (error) return <p role="alert" className="text-destructive">{error.message}</p>;
  if (isPending) {
    return <div className="grid gap-6"><Skeleton className="h-16 w-80" /><Skeleton className="h-64" /></div>;
  }

  const { member, payments, notifications, app_access } = data;
  const active = member.subscription_status === 'active';
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <>
      <Link to="/admin/members" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All members
      </Link>
      <PageHeader
        title={<><MemberAvatar name={member.name} className="size-11 text-base" />{member.name}<StatusBadge status={member.payment_status} /></>}
        description={
          <>
            {formatPhone(member.phone)}{member.email ? ` · ${member.email}` : ''} · joined {formatDate(member.joined_on)}
            {member.notes && <span className="mt-1 block text-foreground">{member.notes}</span>}
          </>
        }
        actions={
          <>
            <Button onClick={() => setModal('pay')}><Wallet aria-hidden /> Record payment</Button>
            {active && <Button variant="outline" onClick={() => remind(member)}><BellRing aria-hidden /> Send reminder</Button>}
            <Button variant="outline" onClick={() => setModal('edit')}><Pencil aria-hidden /> Edit</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal aria-hidden /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {active ? (
                  <>
                    <DropdownMenuItem onSelect={() => run(() => patch.mutateAsync({ status: 'paused' }), 'Membership paused. No alerts will be sent.')}>
                      <Pause aria-hidden /> Pause membership
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setConfirm('cancel')}><UserX aria-hidden /> Cancel membership</DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onSelect={() => setModal('resume')}><Play aria-hidden /> Resume membership</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setConfirm('delete')}><Trash2 aria-hidden /> Delete member</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-[5fr_7fr]">
        <Card>
          <CardHeader><CardTitle>Membership</CardTitle></CardHeader>
          <CardContent className="grid gap-5">
            <dl className="divide-y text-sm">
              {[
                ['Plan', `${member.plan_name}, ${formatINR(member.plan_price)} for ${planLength(member.duration_months)}`],
                ['Started', formatDate(member.start_date)],
                ['Next payment due', `${formatDate(member.next_due_date)}${dueText(member) ? ` (${dueText(member)})` : ''}`],
                ['Paid so far', `${formatINR(totalPaid)} in ${payments.length} payment${payments.length === 1 ? '' : 's'}`],
                ['App sign-in', ACCESS_TEXT[app_access.status] + (app_access.last_login_at ? `, last signed in ${formatDate(app_access.last_login_at.slice(0, 10))}` : '')],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 py-2.5">
                  <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <Button variant="outline" size="sm" onClick={() => setModal('invite')}>
                <KeyRound aria-hidden /> {app_access.status === 'active' ? 'Reset password link' : 'Invite to the app'}
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="change-plan">Change plan</Label>
              <Select
                value={String(member.plan_id)}
                onValueChange={(value) => run(() => patch.mutateAsync({ plan_id: Number(value) }), 'Plan changed. It applies from the next payment.')}
              >
                <SelectTrigger id="change-plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(plans.data ?? []).filter((p) => p.is_active || p.id === member.plan_id).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} · {formatINR(p.price)} for {planLength(p.duration_months)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
          <CardContent className="px-0 pb-2">
            {payments.length === 0 ? (
              <EmptyState icon={Receipt} title="No payments recorded yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paid on</TableHead><TableHead>Amount</TableHead><TableHead>Paid by</TableHead><TableHead>Covers until</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paid_on)}{p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{formatINR(p.amount)}</TableCell>
                      <TableCell>{METHOD[p.method]}</TableCell>
                      <TableCell>{formatDate(p.period_end)}</TableCell>
                      <TableCell className="text-right">
                        {i === 0 && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirm({ undo: p })}>Undo</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Messages sent</CardTitle></CardHeader>
        <CardContent className="px-0 pb-2">
          {notifications.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No messages yet">Reminders go out automatically before each due date.</EmptyState>
          ) : (
            <NotificationTable rows={notifications} showMember={false} />
          )}
        </CardContent>
      </Card>

      {modal === 'pay' && <PaymentDialog member={member} onClose={() => setModal(null)} />}
      {modal === 'edit' && <MemberDialog member={member} onClose={() => setModal(null)} />}
      <ResumeDialog isOpen={modal === 'resume'} memberId={id} onClose={() => setModal(null)} />
      {modal === 'invite' && <InviteDialog member={member} isReset={app_access.status === 'active'} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Cancel this membership?"
        description="Alerts stop. You can resume it later."
        confirmLabel="Cancel membership"
        destructive
        onConfirm={() => run(() => patch.mutateAsync({ status: 'cancelled' }), 'Membership cancelled.')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete ${member.name}?`}
        description="This removes the member and all of their payment history. It cannot be undone."
        confirmLabel="Delete member"
        destructive
        onConfirm={() => run(async () => { await del.mutateAsync(); navigate('/admin/members', { replace: true }); }, 'Member deleted.')}
      />
      <ConfirmDialog
        open={typeof confirm === 'object' && confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Remove this payment?"
        description={
          typeof confirm === 'object' && confirm
            ? `The ${formatINR(confirm.undo.amount)} payment from ${formatDate(confirm.undo.paid_on)} will be removed, and the next due date goes back to ${formatDate(confirm.undo.previous_due_date)}.`
            : ''
        }
        confirmLabel="Remove payment"
        destructive
        onConfirm={() => typeof confirm === 'object' && confirm && run(() => undo.mutateAsync(confirm.undo.id), 'Payment removed.')}
      />
    </>
  );
}
