import { Link } from 'react-router-dom';
import { ArrowRight, Dumbbell, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { normalizeIndianPhone } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DoorSign, HoursTable } from '@/components/landing/hours';
import { OfferCard } from '@/components/landing/OfferCard';
import { PlanCard } from '@/components/landing/PlanCard';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { digitsOnly } from '@/lib/format';
import { useMe, usePublicLanding } from '@/lib/queries';
import { homePathFor } from '@/lib/roles';

/**
 * The public front page. Everyone sees the same page, signed in or not. Every word of it
 * (gym details, offers, plans, opening hours) is set by the owner in the dashboard.
 */
export default function Landing() {
  const { data, isPending, error } = usePublicLanding();
  const { data: user } = useMe();
  useDocumentTitle(data ? `${data.gym.gym_name}${data.gym.tagline ? ` · ${data.gym.tagline}` : ''}` : undefined);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p role="alert" className="max-w-sm text-muted-foreground">We could not load this page. Please check your connection and try again.</p>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="min-h-screen bg-sidebar p-8" aria-busy="true">
        <Skeleton className="mb-16 h-10 w-48 bg-sidebar-accent" />
        <Skeleton className="h-24 w-2/3 bg-sidebar-accent" />
      </div>
    );
  }

  const { gym, hours, plans, offers } = data;
  const mobile = normalizeIndianPhone(gym.contact_phone);
  const phoneHref = `tel:${mobile ? `+${mobile}` : `+${digitsOnly(gym.contact_phone)}`}`;
  const hasContact = Boolean(gym.address || gym.contact_phone || gym.contact_email);
  const loginTarget = user ? homePathFor(user) : '/login';
  const loginLabel = user ? 'Open my dashboard' : 'Member login';

  const links = [
    offers.length > 0 && ['Offers', '#offers'],
    ['Plans', '#plans'],
    ['Timings', '#timings'],
    (gym.about || gym.facilities.length > 0) && ['About', '#about'],
    ['Contact', '#contact'],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="bg-background text-foreground">
      {/* ---------- hero ---------- */}
      <section className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <header className="flex items-center justify-between gap-4 py-5">
            <a href="#top" className="flex items-center gap-3 font-display text-xl font-bold text-white">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Dumbbell className="size-5" aria-hidden />
              </span>
              <span className="truncate">{gym.gym_name}</span>
            </a>
            <nav aria-label="Page sections" className="hidden items-center gap-6 text-sm font-medium md:flex">
              {links.map(([label, href]) => (
                <a key={href} href={href} className="hover:text-white">{label}</a>
              ))}
            </nav>
            <Button asChild variant="secondary" size="sm">
              <Link to={loginTarget}>{loginLabel}</Link>
            </Button>
          </header>

          <div id="top" className="grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[1.25fr_1fr] lg:pb-24 lg:pt-16">
            <div>
              <h1 className="font-display text-6xl font-bold leading-[0.92] text-white sm:text-7xl lg:text-8xl">{gym.gym_name}</h1>
              {gym.tagline && <p className="mt-6 max-w-xl text-xl text-sidebar-foreground">{gym.tagline}</p>}
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-sidebar hover:bg-white/90" aria-label="View membership plans">
                  <a href="#plans">See membership plans <ArrowRight aria-hidden /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" aria-label={loginLabel}>
                  <Link to={loginTarget}>{loginLabel}</Link>
                </Button>
              </div>
            </div>
            <DoorSign hours={hours} />
          </div>
        </div>
      </section>

      <main>
        {/* ---------- offers ---------- */}
        {offers.length > 0 && (
          <section id="offers" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 md:px-8">
            <h2 className="text-4xl font-semibold">Offers</h2>
            <p className="mt-2 text-muted-foreground">Running now. Quote the code at the front desk when you join or renew.</p>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
            </div>
          </section>
        )}

        {/* ---------- plans ---------- */}
        <section id="plans" className={`scroll-mt-4 px-4 py-16 md:px-8 ${offers.length > 0 ? 'bg-muted/60' : ''}`}>
          <div className="mx-auto max-w-6xl">
            <h2 className="text-4xl font-semibold">Membership plans</h2>
            <p className="mt-2 text-muted-foreground">Pay at the front desk by cash, UPI or card. Ask us about any plan.</p>
            {plans.length === 0 ? (
              <p className="mt-8 text-muted-foreground">Plans will be listed here soon.</p>
            ) : (
              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
              </div>
            )}
          </div>
        </section>

        {/* ---------- timings ---------- */}
        <section id="timings" className="mx-auto grid max-w-6xl scroll-mt-4 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-4xl font-semibold">Opening hours</h2>
            <p className="mt-2 text-muted-foreground">All times are India time. Hours can change on holidays, so check the sign above before you travel.</p>
          </div>
          {hours.length === 0 ? (
            <p className="text-muted-foreground">Opening hours will be listed here soon.</p>
          ) : (
            <HoursTable hours={hours} />
          )}
        </section>

        {/* ---------- about ---------- */}
        {(gym.about || gym.facilities.length > 0) && (
          <section id="about" className="scroll-mt-4 bg-muted/60 px-4 py-16 md:px-8">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.2fr]">
              <h2 className="text-4xl font-semibold">About {gym.gym_name}</h2>
              <div>
                {gym.about && <p className="max-w-2xl whitespace-pre-line text-lg leading-relaxed">{gym.about}</p>}
                {gym.facilities.length > 0 && (
                  <ul className="mt-6 flex flex-wrap gap-2" aria-label="Facilities">
                    {gym.facilities.map((facility) => (
                      <li key={facility} className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium">{facility}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ---------- contact ---------- */}
        <section id="contact" className="mx-auto grid max-w-6xl scroll-mt-4 gap-10 px-4 py-16 md:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-4xl font-semibold">Visit us</h2>
            {hasContact && <p className="mt-2 text-muted-foreground">Drop in, call, or message us. We are happy to show you around.</p>}
          </div>
          <div className="grid gap-6">
            {hasContact && (
              <ul className="grid gap-4 text-lg">
                {gym.address && (
                  <li className="flex items-start gap-3"><MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden /><span className="whitespace-pre-line">{gym.address}</span></li>
                )}
                {gym.contact_phone && (
                  <li className="flex items-center gap-3"><Phone className="size-5 shrink-0 text-primary" aria-hidden /><a href={phoneHref} className="font-medium hover:underline">{gym.contact_phone}</a></li>
                )}
                {mobile && (
                  <li className="flex items-center gap-3"><MessageCircle className="size-5 shrink-0 text-primary" aria-hidden /><a href={`https://wa.me/${mobile}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">Message us on WhatsApp</a></li>
                )}
                {gym.contact_email && (
                  <li className="flex items-center gap-3"><Mail className="size-5 shrink-0 text-primary" aria-hidden /><a href={`mailto:${gym.contact_email}`} className="font-medium hover:underline">{gym.contact_email}</a></li>
                )}
              </ul>
            )}
            <div className="rounded-lg border bg-card p-6">
              <p className="font-display text-2xl font-semibold">Already a member?</p>
              <p className="mt-1 text-muted-foreground">See your membership status, payment reminders and current offers.</p>
              <Button asChild className="mt-4"><Link to={loginTarget}>{loginLabel}</Link></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-sidebar px-4 py-8 text-sm text-sidebar-muted md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {gym.gym_name}</p>
          <Link to={loginTarget} className="text-sidebar-foreground hover:text-white" aria-label={loginLabel}>{loginLabel}</Link>
        </div>
      </footer>
    </div>
  );
}
