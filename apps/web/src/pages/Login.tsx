import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useLogin, useMe, usePublicLanding } from '@/lib/queries';
import { homePathFor } from '@/lib/roles';

export default function Login() {
  const { data: me } = useMe();
  const { data: landing } = usePublicLanding();
  const login = useLogin();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const gym = landing?.gym.gym_name ?? 'Gym Tracker';
  useDocumentTitle(`Sign in · ${gym}`);

  if (me) return <Navigate to={homePathFor(me)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { user } = await login.mutateAsync({ identifier, password });
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <span className="flex items-center gap-3 font-display text-2xl font-bold text-white">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          {gym}
        </span>
        <div className="max-w-md">
          <p className="font-display text-5xl font-semibold leading-[1.05] text-white">Your membership, in your pocket.</p>
          <p className="mt-4 text-lg text-sidebar-muted">See when your next payment is due, your reminders, and the latest offers.</p>
        </div>
        <p className="text-sm text-sidebar-muted">Gym owners sign in here too, to run the gym.</p>
      </section>

      <section className="flex flex-col items-center justify-center gap-4 p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Use the email or mobile number you registered with.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="identifier">Email or mobile number</Label>
                <Input
                  id="identifier"
                  autoComplete="username"
                  inputMode="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  spellCheck={false}
                />
              </div>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={login.isPending} aria-busy={login.isPending}>
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-sm text-muted-foreground">
                New member? Open the sign-in link your gym sent you to choose a password. Forgot yours? Ask the front desk for a new link.
              </p>
            </form>
          </CardContent>
        </Card>
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Back to {gym}
        </Link>
      </section>
    </div>
  );
}
