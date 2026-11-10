import { Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/queries';
import { homePathFor } from '@/lib/roles';
import { Skeleton } from '@/components/ui/skeleton';
import Activate from '@/pages/Activate';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Dashboard from '@/pages/admin/Dashboard';
import MemberDetail from '@/pages/admin/MemberDetail';
import Members from '@/pages/admin/Members';
import Offers from '@/pages/admin/Offers';
import Plans from '@/pages/admin/Plans';
import Website from '@/pages/admin/Website';
import MemberAccount from '@/pages/member/Account';
import MemberHome from '@/pages/member/Home';
import MemberOffers from '@/pages/member/Offers';
import MemberPayments from '@/pages/member/Payments';

// Lazy-load heavy admin pages for code-splitting
const Messages = lazy(() => import('@/pages/admin/Messages'));
const Settings = lazy(() => import('@/pages/admin/Settings'));

/** Skeleton fallback for lazy-loaded routes. */
function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  );
}

/** /app sends signed-in people to the right home for their role. */
function HomeRedirect() {
  const { data: user, isPending } = useMe();
  if (isPending) return null;
  return <Navigate to={user ? homePathFor(user) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Open to everyone */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/activate/:token" element={<Activate />} />
      <Route path="/app" element={<HomeRedirect />} />

      {/* Owner */}
      <Route element={<RequireRole role="owner"><AppShell /></RequireRole>}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/members" element={<Members />} />
        <Route path="/admin/members/:id" element={<MemberDetail />} />
        <Route path="/admin/plans" element={<Plans />} />
        <Route path="/admin/offers" element={<Offers />} />
        <Route path="/admin/website" element={<Website />} />
        <Route path="/admin/messages" element={<Suspense fallback={<PageSkeleton />}><Messages /></Suspense>} />
        <Route path="/admin/settings" element={<Suspense fallback={<PageSkeleton />}><Settings /></Suspense>} />
      </Route>

      {/* Member */}
      <Route element={<RequireRole role="member"><AppShell /></RequireRole>}>
        <Route path="/me" element={<MemberHome />} />
        <Route path="/me/payments" element={<MemberPayments />} />
        <Route path="/me/offers" element={<MemberOffers />} />
        <Route path="/me/account" element={<MemberAccount />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
