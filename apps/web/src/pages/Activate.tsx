import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Dumbbell, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useActivate, useInviteInfo, usePublicLanding } from '@/lib/queries';
import { homePathFor } from '@/lib/roles';

/** Where a member lands from the link the gym sent them: choose a password, and they are signed in. */
export default function Activate() {
  const token = useParams().token ?? '';
  const { data: invite, isPending, error: inviteError } = useInviteInfo(token);
  const { data: landing } = usePublicLanding();
  const activate = useActivate();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const gym = landing?.gym.gym_name ?? 'Gym Tracker';
  useDocumentTitle(`Set your password · ${gym}`);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    try {
      const { user } = await activate.mutateAsync({ token, password });
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your password.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-sidebar p-6">
      <span className="flex items-center gap-3 font-display text-2xl font-bold text-white">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        {gym}
      </span>

      <Card className="w-full max-w-sm">
        {isPending ? (
          <CardContent className="grid gap-3 p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-10" /><Skeleton className="h-10" /></CardContent>
        ) : inviteError ? (
          <>
            <CardHeader>
              <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-status-miss-soft text-status-miss"><LinkIcon className="size-5" aria-hidden /></span>
              <CardTitle className="text-2xl">This link can't be used</CardTitle>
              <CardDescription role="alert">{inviteError.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full"><Link to="/login">Go to sign in</Link></Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">{invite.is_reset ? 'Choose a new password' : `Welcome, ${invite.name.split(' ')[0]}`}</CardTitle>
              <CardDescription>
                {invite.is_reset
                  ? 'Pick a new password. You will be signed in right after.'
                  : 'Choose a password to see your membership, reminders and offers.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4" noValidate>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    spellCheck={false}
                  />
                  <p className="text-sm text-muted-foreground">At least 8 characters.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Repeat the password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" disabled={activate.isPending} aria-busy={activate.isPending}>
                  {activate.isPending ? 'Saving…' : 'Save password and sign in'}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
