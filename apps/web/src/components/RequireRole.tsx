import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { RoleKey } from '@gym/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/queries';
import { hasRole, homePathFor } from '@/lib/roles';

/** Signed-out visitors go to the login page; signed-in people without this role go to their own home. */
export function RequireRole({ role, children }: { role: RoleKey; children: ReactNode }) {
  const { data: user, isPending } = useMe();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="p-8" aria-busy="true"><Skeleton className="h-10 w-64" /></div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!hasRole(user, role)) return <Navigate to={homePathFor(user)} replace />;
  return <>{children}</>;
}
