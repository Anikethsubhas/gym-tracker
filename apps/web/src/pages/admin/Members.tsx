import { useState, useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { MemberAvatar } from '@/components/MemberAvatar';
import { InviteDialog } from '@/components/InviteDialog';
import { MemberDialog } from '@/components/MemberDialog';
import { PageHeader } from '@/components/PageHeader';
import { PaymentDialog } from '@/components/PaymentDialog';
import { StatusBadge, dueText } from '@/components/StatusBadge';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatDate, formatPhone } from '@/lib/format';
import { useMembers } from '@/lib/queries';
import type { MemberOverview } from '@gym/shared';

const FILTERS: [string, string][] = [
  ['all', 'All'],
  ['due_soon', 'Due soon'],
  ['overdue', 'Overdue'],
  ['missed', 'Missed'],
  ['paid_up', 'Paid up'],
  ['inactive', 'Paused or cancelled'],
];

/** Row component with content-visibility for virtualization */
function MemberRow({ member }: { member: MemberOverview }) {
  return (
    <TableRow className="content-visibility-auto contain-intrinsic-size-0-[50px]">
      <TableCell>
        <div className="flex items-center gap-3">
          <MemberAvatar name={member.name} />
          <div>
            <Link to={`/admin/members/${member.id}`} className="font-semibold hover:underline">{member.name}</Link>
            <div className="text-xs text-muted-foreground">{formatPhone(member.phone)}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{member.plan_name}</TableCell>
      <TableCell>
        {formatDate(member.next_due_date)}
        <div className="text-xs text-muted-foreground">{dueText(member)}</div>
      </TableCell>
      <TableCell><StatusBadge status={member.payment_status} /></TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" onClick={() => { /* handled by parent */ }}>Record payment</Button>
      </TableCell>
    </TableRow>
  );
}

export default function Members() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim());

  // Use deferred value for expensive filtering on large lists
  const deferredSearch = useDeferredValue(debounced);

  const { data: members, isPending, error } = useMembers({
    search: deferredSearch,
    status: status === 'all' ? '' : status
  });

  // Memoize filtered members to avoid recomputation
  const filteredMembers = useMemo(() => {
    if (!members || !search.trim()) return members ?? [];
    const term = search.trim().toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(term) ||
      m.phone.includes(term.replace(/\D/g, ''))
    );
  }, [members, search]);

  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<MemberOverview | null>(null);
  const [inviting, setInviting] = useState<MemberOverview | null>(null);

  return (
    <>
      <PageHeader
        title="Members"
        description={filteredMembers ? `${filteredMembers.length} shown` : undefined}
        actions={<Button onClick={() => setAdding(true)}><Plus aria-hidden /> Add member</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search by name or phone"
            aria-label="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-w-full overflow-x-auto">
          <Tabs value={status} onValueChange={(v) => setParams(v === 'all' ? {} : { status: v })}>
            <TabsList aria-label="Filter by status">
              {FILTERS.map(([value, label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card>
        {error ? (
          <p role="alert" className="p-5 text-destructive">{error.message}</p>
        ) : isPending ? (
          <div className="grid gap-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : filteredMembers.length === 0 ? (
          <EmptyState icon={Users} title={debounced || status !== 'all' ? 'No members match' : 'No members yet'}>
            {debounced || status !== 'all' ? 'Try a different search or filter.' : 'Add your first member to start tracking payments.'}
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead><TableHead>Plan</TableHead><TableHead>Next due</TableHead><TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((m) => (
                <TableRow
                  key={m.id}
                  className="content-visibility-auto contain-intrinsic-size-0-[50px]"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={m.name} />
                      <div>
                        <Link to={`/admin/members/${m.id}`} className="font-semibold hover:underline">{m.name}</Link>
                        <div className="text-xs text-muted-foreground">{formatPhone(m.phone)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{m.plan_name}</TableCell>
                  <TableCell>
                    {formatDate(m.next_due_date)}
                    <div className="text-xs text-muted-foreground">{dueText(m)}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={m.payment_status} /></TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPaying(m)}
                    >
                      Record payment
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {adding && <MemberDialog onClose={() => setAdding(false)} onCreated={setInviting} />}
      {inviting && <InviteDialog member={inviting} justAdded onClose={() => setInviting(null)} />}
      {paying && <PaymentDialog member={paying} onClose={() => setPaying(null)} />}
    </>
  );
}
