import { useRef, useState, type FormEvent } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DAY_NAMES, type GymProfile, type HourSlot } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/PageHeader';
import { useSaveHours, useSaveProfile, useWebsite } from '@/lib/queries';

function ProfileCard({ profile }: { profile: GymProfile }) {
  const save = useSaveProfile();
  const [name, setName] = useState(profile.gym_name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [about, setAbout] = useState(profile.about);
  const [facilities, setFacilities] = useState(profile.facilities.join('\n'));
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.contact_phone);
  const [email, setEmail] = useState(profile.contact_email);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        gym_name: name, tagline, about, address, contact_phone: phone, contact_email: email,
        facilities: facilities.split('\n').map((f) => f.trim()).filter(Boolean),
      });
      toast.success('Gym details saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gym details</CardTitle>
        <CardDescription>What visitors read on your landing page.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="w-name">Gym name</Label>
            <Input id="w-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-sm text-muted-foreground">Also used in the messages members receive.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-tagline">Tagline</Label>
            <Input id="w-tagline" maxLength={120} placeholder="Train hard. Pay easy." value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-about">About the gym</Label>
            <Textarea id="w-about" rows={4} maxLength={1000} value={about} onChange={(e) => setAbout(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-facilities">Facilities</Label>
            <Textarea id="w-facilities" rows={4} placeholder={'Cardio\nFree weights\nShowers'} value={facilities} onChange={(e) => setFacilities(e.target.value)} />
            <p className="text-sm text-muted-foreground">One per line. Up to 12.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-address">Address</Label>
            <Textarea id="w-address" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="w-phone">Phone number to show</Label>
              <Input id="w-phone" inputMode="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-sm text-muted-foreground">A mobile number also gets a WhatsApp link.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="w-email">Email to show</Label>
              <Input id="w-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <div><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save gym details'}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

interface Row {
  key: number;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  label: string;
}

function HoursCard({ initial }: { initial: HourSlot[] }) {
  const save = useSaveHours();
  const nextKey = useRef(0);
  const makeRow = (day: number, opens = '06:00', closes = '22:00', label = ''): Row => ({
    key: nextKey.current++, day_of_week: day, opens_at: opens, closes_at: closes, label,
  });
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((s) => makeRow(s.day_of_week, s.opens_at, s.closes_at, s.label ?? '')),
  );
  const [error, setError] = useState('');

  const forDay = (day: number) => rows.filter((r) => r.day_of_week === day);
  const patch = (key: number, change: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));

  function setOpen(day: number, open: boolean) {
    setRows((all) => (open ? [...all, makeRow(day)] : all.filter((r) => r.day_of_week !== day)));
  }
  function addSlot(day: number) {
    const last = forDay(day).at(-1);
    const opens = last && last.closes_at < '20:00' ? last.closes_at : '16:00';
    setRows((all) => [...all, makeRow(day, opens, '22:00')]);
  }
  function copyMonday() {
    const monday = forDay(1);
    setRows((all) => [
      ...all.filter((r) => r.day_of_week === 1),
      ...[2, 3, 4, 5, 6, 7].flatMap((day) => monday.map((r) => makeRow(day, r.opens_at, r.closes_at, r.label))),
    ]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        slots: rows.map((r) => ({ day_of_week: r.day_of_week, opens_at: r.opens_at, closes_at: r.closes_at, label: r.label || null })),
      });
      toast.success('Opening hours saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening hours</CardTitle>
        <CardDescription>Switch a day off to show it as closed. Add a second time slot for split shifts, such as morning and evening. All times are India time.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <ul className="divide-y rounded-lg border">
            {DAY_NAMES.map((name, i) => {
              const day = i + 1;
              const slots = forDay(day);
              return (
                <li key={name} className="grid gap-3 p-4 sm:grid-cols-[10rem_1fr]">
                  <div className="flex items-center gap-3">
                    <Switch id={`open-${day}`} checked={slots.length > 0} onCheckedChange={(open) => setOpen(day, open)} aria-label={`${name} open`} />
                    <Label htmlFor={`open-${day}`} className="cursor-pointer text-base">{name}</Label>
                  </div>
                  {slots.length === 0 ? (
                    <p className="self-center text-muted-foreground">Closed</p>
                  ) : (
                    <div className="grid gap-2">
                      {slots.map((r) => (
                        <div key={r.key} className="flex flex-wrap items-center gap-2">
                          <Input className="w-32" aria-label={`${name} slot name`} placeholder="Name (optional)" maxLength={30} value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} />
                          <Input className="w-32" type="time" required aria-label={`${name} opens`} value={r.opens_at} onChange={(e) => patch(r.key, { opens_at: e.target.value })} />
                          <span className="text-muted-foreground">to</span>
                          <Input className="w-32" type="time" required aria-label={`${name} closes`} value={r.closes_at} onChange={(e) => patch(r.key, { closes_at: e.target.value })} />
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove this ${name} time slot`} onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}>
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      ))}
                      <div><Button type="button" variant="ghost" size="sm" onClick={() => addSlot(day)}><Plus aria-hidden /> Add a time slot</Button></div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save opening hours'}</Button>
            <Button type="button" variant="outline" onClick={copyMonday}>Copy Monday to every day</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Website() {
  const { data, isPending, error } = useWebsite();
  return (
    <>
      <PageHeader
        title="Website"
        description="Your landing page, and what members see about the gym in their app."
        actions={
          <Button asChild variant="outline">
            <a href="/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> View landing page</a>
          </Button>
        }
      />
      {error ? (
        <p role="alert" className="text-destructive">{error.message}</p>
      ) : isPending ? (
        <div className="grid max-w-3xl gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      ) : (
        <div className="grid max-w-3xl gap-6">
          <ProfileCard profile={data.profile} />
          <HoursCard initial={data.hours} />
          <p className="text-sm text-muted-foreground">Plans are edited on the Plans page and offers on the Offers page. Both appear on the landing page automatically.</p>
        </div>
      )}
    </>
  );
}
