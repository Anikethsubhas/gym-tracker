import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  ActivateInput, AuthUser, ChangePasswordInput, CheckSummary, CreateMemberInput, DashboardData, HourSlot, HoursInput,
  InviteInfo, InviteLink, LoginInput, MemberDetail, MemberOverview, MyMembership, MyProfileInput, NotificationEntry,
  OfferAdmin, OfferInput, PaymentInput, PlanInput, PlanWithCount, PublicLanding, RemindResponse, Settings,
  SettingsInput, SubscriptionPatchInput, UpdateMemberInput, WebsiteAdminData, WebsiteProfileInput, GymProfile,
} from '@gym/shared';
import { api, ApiError } from './api';

/* ---------------- query keys ---------------- */
export interface MemberFilters {
  search: string;
  status: string;
}

export const qk = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  members: (filters: MemberFilters) => ['members', filters] as const,
  member: (id: number) => ['member', id] as const,
  plans: ['plans'] as const,
  settings: ['settings'] as const,
  notifications: (status: string) => ['notifications', status] as const,
  landing: ['landing'] as const,
  myMembership: ['my-membership'] as const,
  offers: ['offers'] as const,
  website: ['website'] as const,
  invite: (token: string) => ['invite', token] as const,
};

/* ---------------- auth (cookie session) ---------------- */
/**
 * Marks nobody as signed in and drops every cached member and payment.
 * The session is set to "signed out" FIRST so the mounted pages see it and the router redirects to the
 * login page; calling queryClient.clear() instead would detach those pages from the cache and leave
 * them showing stale screens.
 */
export function endSession(qc: QueryClient) {
  void qc.cancelQueries();
  qc.setQueryData(qk.me, null);
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

/** Who is signed in, and with which roles? The browser sends the session cookie; a 401 simply means "nobody". */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return await api<AuthUser>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: AuthUser }>('/auth/login', { method: 'POST', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(qk.me, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => endSession(qc),
  });
}

/** The page behind an invite link: who is it for? */
export const useInviteInfo = (token: string) =>
  useQuery({ queryKey: qk.invite(token), queryFn: () => api<InviteInfo>(`/auth/invite/${token}`), retry: false, staleTime: Infinity });

/** Sets the password from an invite link and signs the person in. */
export function useActivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActivateInput) => api<{ user: AuthUser }>('/auth/activate', { method: 'POST', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(qk.me, user),
  });
}

export const useChangePassword = () =>
  useMutation({ mutationFn: (input: ChangePasswordInput) => api<void>('/auth/password', { method: 'POST', body: input }) });

export function useUpdateMyEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MyProfileInput) => api<void>('/me/profile', { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries(), // the email shows in the account and in the signed-in user
  });
}

/* ---------------- reads ---------------- */
export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: () => api<DashboardData>('/dashboard') });

export function useMembers(filters: MemberFilters) {
  return useQuery({
    queryKey: qk.members(filters),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters.status) qs.set('status', filters.status);
      if (filters.search) qs.set('search', filters.search);
      return api<MemberOverview[]>(`/members?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
}

export const useMember = (id: number) =>
  useQuery({ queryKey: qk.member(id), queryFn: () => api<MemberDetail>(`/members/${id}`), enabled: Number.isInteger(id) });

export const usePlans = () => useQuery({ queryKey: qk.plans, queryFn: () => api<PlanWithCount[]>('/plans') });

/** Owner only. Members get the gym name from the public landing data instead. */
export const useSettings = (enabled = true) =>
  useQuery({ queryKey: qk.settings, queryFn: () => api<Settings>('/settings'), staleTime: 60_000, enabled });

/* ---- shared by everyone ---- */
/** The landing page content: gym profile, opening hours, plans and live offers. Needs no sign-in. */
export const usePublicLanding = () =>
  useQuery({ queryKey: qk.landing, queryFn: () => api<PublicLanding>('/public/landing'), staleTime: 30_000 });

/* ---- member ---- */
export const useMyMembership = () =>
  useQuery({ queryKey: qk.myMembership, queryFn: () => api<MyMembership>('/me/membership') });

/* ---- owner: website content ---- */
export const useOffers = () => useQuery({ queryKey: qk.offers, queryFn: () => api<OfferAdmin[]>('/offers') });
export const useWebsite = () => useQuery({ queryKey: qk.website, queryFn: () => api<WebsiteAdminData>('/website') });

export const useNotifications = (status: string) =>
  useQuery({
    queryKey: qk.notifications(status),
    queryFn: () => api<NotificationEntry[]>(`/notifications?limit=200${status ? `&status=${status}` : ''}`),
    placeholderData: keepPreviousData,
  });

/* ---------------- writes ----------------
   Almost every change can affect several screens (a payment changes the member, the dashboard,
   the member list and the message log), so a successful write refreshes everything on screen
   except the session itself. */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

export function useCreateMember() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: CreateMemberInput) => api<MemberOverview>('/members', { method: 'POST', body: input }),
    onSuccess: refresh,
  });
}

export function useUpdateMember(id: number) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: UpdateMemberInput) => api<MemberOverview>(`/members/${id}`, { method: 'PUT', body: input }),
    onSuccess: refresh,
  });
}

export function useDeleteMember(id: number) {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: () => api<void>(`/members/${id}`, { method: 'DELETE' }), onSuccess: refresh });
}

export function usePatchSubscription(id: number) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: SubscriptionPatchInput) =>
      api<MemberOverview>(`/members/${id}/subscription`, { method: 'PATCH', body: input }),
    onSuccess: refresh,
  });
}

export function useRecordPayment(id: number) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: PaymentInput) => api<MemberOverview>(`/members/${id}/payments`, { method: 'POST', body: input }),
    onSuccess: refresh,
  });
}

export function useUndoPayment(memberId: number) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (paymentId: number) =>
      api<MemberOverview>(`/members/${memberId}/payments/${paymentId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export function useRemind() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (memberId: number) => api<RemindResponse>(`/members/${memberId}/remind`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

export function useRunChecks() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: () => api<CheckSummary>('/jobs/run-checks', { method: 'POST' }), onSuccess: refresh });
}

export function useSavePlan(id?: number) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: PlanInput) =>
      id ? api(`/plans/${id}`, { method: 'PUT', body: input }) : api('/plans', { method: 'POST', body: input }),
    onSuccess: refresh,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: SettingsInput) => api<Settings>('/settings', { method: 'PUT', body: input }),
    onSuccess: (saved) => {
      qc.setQueryData(qk.settings, saved);
      return refresh(); // grace days and reminder days change every member's status
    },
  });
}

/* ---- owner: invite a member to the app ---- */
export const useInvite = (memberId: number) =>
  useMutation({ mutationFn: () => api<InviteLink>(`/members/${memberId}/invite`, { method: 'POST' }) });

/* ---- owner: website content ---- */
export function useSaveOffer(id?: number) {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: OfferInput) =>
      id ? api<OfferAdmin>(`/offers/${id}`, { method: 'PUT', body: input }) : api<OfferAdmin>('/offers', { method: 'POST', body: input }),
    onSuccess: refresh,
  });
}

export function useDeleteOffer() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (id: number) => api<void>(`/offers/${id}`, { method: 'DELETE' }), onSuccess: refresh });
}

export function useSaveProfile() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: WebsiteProfileInput) => api<GymProfile>('/website/profile', { method: 'PUT', body: input }),
    onSuccess: refresh,
  });
}

export function useSaveHours() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: HoursInput) => api<HourSlot[]>('/website/hours', { method: 'PUT', body: input }),
    onSuccess: refresh,
  });
}
