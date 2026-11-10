import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Settings as SettingsData } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/PageHeader';
import { formatPhone } from '@/lib/format';
import { useSettings, useUpdateSettings } from '@/lib/queries';

function SettingsForm({ settings }: { settings: SettingsData }) {
  const update = useUpdateSettings();
  const [phone, setPhone] = useState(settings.owner_phone ? formatPhone(settings.owner_phone) : '');
  const [remindDays, setRemindDays] = useState(String(settings.reminder_days_before));
  const [graceDays, setGraceDays] = useState(String(settings.grace_days));
  const [sms, setSms] = useState(settings.sms_enabled);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_enabled);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await update.mutateAsync({
        owner_phone: phone || null,
        reminder_days_before: Number(remindDays),
        grace_days: Number(graceDays),
        sms_enabled: sms,
        whatsapp_enabled: whatsapp,
      });
      toast.success('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Your contact</CardTitle>
          <CardDescription>Your gym name and public contact details are on the Website page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="s-phone">Your mobile number</Label>
            <Input id="s-phone" inputMode="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="text-sm text-muted-foreground">Missed-payment alerts for you are sent here. Leave empty to turn them off.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment alerts</CardTitle>
          <CardDescription>A payment counts as missed once the grace period has passed. That is when the member and you are alerted.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="s-remind">Remind members before the due date (days)</Label>
              <Input id="s-remind" type="number" min="0" max="30" required value={remindDays} onChange={(e) => setRemindDays(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-grace">Grace period after the due date (days)</Label>
              <Input id="s-grace" type="number" min="0" max="30" required value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="s-sms" className="cursor-pointer">Send alerts by SMS</Label>
              <Switch id="s-sms" checked={sms} onCheckedChange={setSms} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="s-wa" className="cursor-pointer">Send alerts by WhatsApp</Label>
              <Switch id="s-wa" checked={whatsapp} onCheckedChange={setWhatsapp} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div><Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save settings'}</Button></div>
    </form>
  );
}

export default function Settings() {
  const { data: settings, isPending, error } = useSettings();
  return (
    <>
      <PageHeader title="Settings" description="How payment alerts behave." />
      {error ? (
        <p role="alert" className="text-destructive">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-96 max-w-2xl" />
      ) : (
        <SettingsForm settings={settings} />
      )}
    </>
  );
}
