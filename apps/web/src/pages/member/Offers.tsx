import { Tag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { OfferCard } from '@/components/landing/OfferCard';
import { PlanCard } from '@/components/landing/PlanCard';
import { usePublicLanding } from '@/lib/queries';

/** Offers and plans, exactly as the owner publishes them. */
export default function MemberOffers() {
  const { data, isPending, error } = usePublicLanding();
  return (
    <>
      <PageHeader title="Offers and plans" description="Quote an offer's code at the front desk when you renew or upgrade." />
      {error ? (
        <p role="alert" className="text-destructive">{error.message}</p>
      ) : isPending ? (
        <div className="grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : (
        <div className="grid gap-10">
          <section aria-labelledby="offers-heading">
            <h2 id="offers-heading" className="mb-4 text-2xl font-semibold">Offers</h2>
            {data.offers.length === 0 ? (
              <Card><EmptyState icon={Tag} title="No offers right now">New offers will show up here.</EmptyState></Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">{data.offers.map((o) => <OfferCard key={o.id} offer={o} />)}</div>
            )}
          </section>
          <section aria-labelledby="plans-heading">
            <h2 id="plans-heading" className="mb-6 text-2xl font-semibold">Plans</h2>
            <div className="grid gap-6 pt-2 md:grid-cols-2 lg:grid-cols-3">{data.plans.map((p) => <PlanCard key={p.id} plan={p} />)}</div>
          </section>
        </div>
      )}
    </>
  );
}
