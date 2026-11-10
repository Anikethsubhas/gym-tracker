import { Check } from 'lucide-react';
import type { PublicPlan } from '@gym/shared';
import { cn } from '@/lib/utils';
import { formatINR, planLength } from '@/lib/format';

export function PlanCard({ plan }: { plan: PublicPlan }) {
  return (
    <article
      className={cn(
        'relative flex flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-sm',
        plan.is_featured && 'border-primary ring-2 ring-primary',
      )}
    >
      {plan.is_featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      )}
      <h3 className="font-display text-2xl font-semibold">{plan.name}</h3>
      <p className="mt-3 font-display text-5xl font-bold tabular-nums">{formatINR(plan.price)}</p>
      <p className="text-sm text-muted-foreground">for {planLength(plan.duration_months)}</p>
      {plan.description && <p className="mt-4 text-sm">{plan.description}</p>}
      {plan.features.length > 0 && (
        <ul className="mt-4 grid gap-2 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-status-paid" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
