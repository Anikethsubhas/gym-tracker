import {
  Dumbbell, FlaskConical, Globe, Home, Layers, LayoutDashboard, LogOut, MessageSquare, MoreHorizontal, Receipt,
  Settings, Tag, Ticket, User, Users, type LucideIcon,
} from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useLogout, useMe, usePublicLanding, useSettings } from '@/lib/queries';
import { hasRole } from '@/lib/roles';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const OWNER_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/plans', label: 'Plans', icon: Layers },
  { to: '/admin/offers', label: 'Offers', icon: Tag },
  { to: '/admin/website', label: 'Website', icon: Globe },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const MEMBER_NAV: NavItem[] = [
  { to: '/me', label: 'Home', icon: Home, end: true },
  { to: '/me/payments', label: 'Payments', icon: Receipt },
  { to: '/me/offers', label: 'Offers', icon: Ticket },
  { to: '/me/account', label: 'Account', icon: User },
];

/** The signed-in layout. What the menu contains depends on the roles the person holds. */
export function AppShell() {
  const { data: user } = useMe();
  const isOwner = hasRole(user, 'owner');
  const isMember = hasRole(user, 'member');
  const { data: landing } = usePublicLanding();
  const { data: settings } = useSettings(isOwner); // the alert settings are private to the owner
  const logout = useLogout();
  const gymName = landing?.gym.gym_name ?? 'Gym Tracker';

  const sections = [
    isOwner && { title: 'Gym', items: OWNER_NAV },
    isMember && { title: 'My membership', items: MEMBER_NAV },
  ].filter(Boolean) as { title: string; items: NavItem[] }[];
  const allItems = sections.flatMap((s) => s.items);
  const bottomItems = allItems.length > 5 ? allItems.slice(0, 4) : allItems;
  const moreItems = allItems.length > 5 ? allItems.slice(4) : [];

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 overflow-y-auto bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
        <Link to="/" className="flex items-center gap-3 px-2" aria-label={`${gymName} home page`}>
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-xl font-bold text-white">{gymName}</span>
            <span className="block text-xs text-sidebar-muted">{isOwner ? 'Owner' : 'Member'}</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-5">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              {sections.length > 1 && <p className="px-3 pb-1 text-xs font-medium text-sidebar-muted">{section.title}</p>}
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to} to={to} end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md border-l-[3px] border-transparent px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent/60',
                      isActive && 'border-primary bg-sidebar-accent text-white',
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 px-2">
          <p className="truncate text-xs text-sidebar-muted">{user?.email ?? user?.phone}</p>
          <Button asChild variant="ghost" size="sm" className="justify-start px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">
            <Link to="/"><Globe aria-hidden /> View landing page</Link>
          </Button>
          <Button variant="ghost" size="sm" className="justify-start px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" onClick={() => logout.mutate()}>
            <LogOut aria-hidden /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <Dumbbell className="size-5 text-primary" aria-hidden /> {gymName}
        </Link>
        <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
          <LogOut aria-hidden /> Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:ml-60 md:px-8 md:pb-12 md:pt-8">
        {isOwner && settings?.messaging_dry_run && (
          <Alert variant="warning" role="status" className="mb-6">
            <FlaskConical className="size-4" aria-hidden />
            <AlertDescription>
              Test mode is on. Alerts are written to Messages but not sent to anyone. To send them for real, set MESSAGING_DRY_RUN=false on the server.
            </AlertDescription>
          </Alert>
        )}
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card md:hidden"
        style={{ gridTemplateColumns: `repeat(${bottomItems.length + (moreItems.length ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {bottomItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground', isActive && 'text-primary')
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
        {moreItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground focus-visible:outline-none">
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              {moreItems.map(({ to, label, icon: Icon }) => (
                <DropdownMenuItem key={to} asChild>
                  <Link to={to}><Icon aria-hidden /> {label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </div>
  );
}
