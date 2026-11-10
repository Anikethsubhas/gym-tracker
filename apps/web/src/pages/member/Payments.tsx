import { Receipt } from 'lucide-react';
import type { PaymentMethod } from '@gym/shared';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { formatDate, formatINR } from '@/lib/format';
import { useMyMembership } from '@/lib/queries';

const METHOD: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };

export default function MemberPayments() {
  const { data, isPending, error } = useMyMembership();
  return (
    <>
      <PageHeader title="Payments" description="Everything you have paid the gym." />
      <Card>
        {error ? (
          <p role="alert" className="p-5 text-destructive">{error.message}</p>
        ) : isPending ? (
          <div className="grid gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : data.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet">When you pay at the front desk, the payment appears here.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Paid on</TableHead><TableHead>Amount</TableHead><TableHead>Paid by</TableHead><TableHead>Plan</TableHead><TableHead>Covers until</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.paid_on)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{formatINR(p.amount)}</TableCell>
                  <TableCell>{METHOD[p.method]}</TableCell>
                  <TableCell>{p.plan_name}</TableCell>
                  <TableCell>{formatDate(p.period_end)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
