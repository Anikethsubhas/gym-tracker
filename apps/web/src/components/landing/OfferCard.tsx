import { Ticket } from 'lucide-react';
import type { Offer } from '@gym/shared';
import { formatValidity } from '@/lib/format';

/** An offer drawn as a ticket: the headline on the stub, the details beside it. */
export function OfferCard({ offer }: { offer: Offer }) {
  const validity = formatValidity(offer.valid_from, offer.valid_until);
  return (
    <article className="flex overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex w-36 shrink-0 flex-col items-center justify-center gap-1 bg-primary p-4 text-center text-primary-foreground">
        {offer.highlight ? (
          <p className="font-display text-3xl font-bold leading-none">{offer.highlight}</p>
        ) : (
          <Ticket className="size-8" aria-hidden />
        )}
      </div>
      <div className="flex-1 border-l-2 border-dashed p-5">
        <h3 className="font-display text-xl font-semibold leading-tight">{offer.title}</h3>
        {offer.description && <p className="mt-1 text-sm text-muted-foreground">{offer.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {offer.code && (
            <span>
              Quote code <span className="rounded bg-muted px-2 py-0.5 font-mono font-semibold">{offer.code}</span> at the desk
            </span>
          )}
          {validity && <span className="text-muted-foreground">{validity}</span>}
        </div>
      </div>
    </article>
  );
}
