import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

export function MemberAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground', className)}
    >
      {initials(name)}
    </span>
  );
}
