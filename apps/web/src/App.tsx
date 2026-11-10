import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { RequireRole } from '@/components/RequireRole';
import { useMe } from '@/lib/queries';
import { homePathFor } from '@/lib/roles';
import Activate from '@/pages/Activate';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Dashboard from '@/pages/admin/Dashboard';
import MemberDetail from '@/pages/admin/MemberDetail';
import Members from '@/pages/admin/Members';
import Messages from '@/pages/admin/Messages';
import Offers from '@/pages/admin/Offers';
import Plans from '@/pages/admin/Plans';
import Settings from '@/pages/admin/Settings';
import Website from '@/pages/admin/Website';
import MemberAccount from '@/pages/member/Account';
import MemberHome from '@/pages/member/Home';
import MemberOffers from '@/pages/member/Offers';
import MemberPayments from '@/pages/member/Payments';

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
        <Route path="/admin/messages" element={<Messages />} />
        <Route path="/admin/settings" element={<Settings />} />
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
