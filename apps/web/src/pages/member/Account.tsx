import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/PageHeader';
import { formatPhone } from '@/lib/format';
import { useChangePassword, useMe, useUpdateMyEmail } from '@/lib/queries';

function EmailForm({ email }: { email: string }) {
  const update = useUpdateMyEmail();
  const [value, setValue] = useState(email);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await update.mutateAsync({ email: value });
      toast.success('Email saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label htmlFor="acc-email">Email (optional)</Label>
      <div className="flex gap-2">
        <Input id="acc-email" type="email" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button type="submit" variant="outline" disabled={update.isPending}>Save</Button>
      </div>
      <p className="text-sm text-muted-foreground">You can sign in with this email as well as your mobile number.</p>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </form>
  );
}

function PasswordForm() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    try {
      await change.mutateAsync({ current_password: current, new_password: next });
      toast.success('Password changed.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="pw-current">Current password</Label>
        <Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-new">New password</Label>
        <Input id="pw-new" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="text-sm text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-confirm">Repeat the new password</Label>
        <Input id="pw-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div><Button type="submit" disabled={change.isPending}>{change.isPending ? 'Saving…' : 'Change password'}</Button></div>
    </form>
  );
}

export default function MemberAccount() {
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <>
      <PageHeader title="Account" description="Your details and how you sign in." />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>Ask the front desk if your name or mobile number needs changing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="divide-y text-sm">
              <div className="flex gap-4 py-2.5"><dt className="w-36 text-muted-foreground">Name</dt><dd className="font-semibold">{user.name}</dd></div>
              <div className="flex gap-4 py-2.5"><dt className="w-36 text-muted-foreground">Mobile number</dt><dd className="font-semibold">{user.phone ? formatPhone(user.phone) : ''}</dd></div>
            </dl>
            <EmailForm key={user.email ?? ''} email={user.email ?? ''} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent><PasswordForm /></CardContent>
        </Card>
      </div>
    </>
  );
}
