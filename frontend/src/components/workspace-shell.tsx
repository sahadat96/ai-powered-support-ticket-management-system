'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  Layers2,
  LogOut,
  Menu,
  Plus,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from './auth-provider';
import { Avatar, ErrorState, Spinner } from './ui';
import { label } from '@/lib/format';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  useEffect(() => {
    if (!loading && !user && !error) router.replace('/login');
  }, [loading, user, error, router]);
  if (loading)
    return (
      <main className="app-loading">
        <span className="brand-mark">
          <Layers2 size={25} />
        </span>
        <Spinner />
        <p>Opening your workspace…</p>
      </main>
    );
  if (!user)
    return error ? (
      <main className="standalone-state">
        <ErrorState message={error} retry={() => void refresh()} />
      </main>
    ) : (
      <main className="app-loading">
        <Spinner />
      </main>
    );
  const staff = user.role !== 'CUSTOMER';
  const current =
    pathname === '/dashboard'
      ? 'Overview'
      : pathname === '/tickets/new'
        ? 'New ticket'
        : pathname.startsWith('/tickets/')
          ? 'Ticket details'
          : 'Tickets';
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    router.push(`/tickets?search=${encodeURIComponent(search.trim())}`);
    setSearch('');
  }
  async function signOut() {
    setSigningOut(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      setLogoutError((error as Error).message);
    } finally {
      setSigningOut(false);
    }
  }
  const closeMenu = () => setMobile(false);
  return (
    <div className="workspace">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={closeMenu} />
      )}
      <aside
        className={`sidebar ${mobile ? 'sidebar-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <Link href="/dashboard" className="brand" onClick={closeMenu}>
          <span className="brand-mark">
            <Layers2 size={23} />
          </span>
          <span>
            relay<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-monogram">S</span>
          <div>
            <strong>Support workspace</strong>
            <span>Working better, together</span>
          </div>
          <span className="workspace-online" title="Workspace" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav">
          <Link
            href="/dashboard"
            onClick={closeMenu}
            className={pathname === '/dashboard' ? 'active' : ''}
            aria-current={pathname === '/dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={19} />
            Overview
          </Link>
          <Link
            href="/tickets"
            onClick={closeMenu}
            className={pathname.startsWith('/tickets') ? 'active' : ''}
            aria-current={pathname.startsWith('/tickets') ? 'page' : undefined}
          >
            <Inbox size={19} />
            {staff ? 'All tickets' : 'My tickets'}
            <ChevronRight size={15} className="nav-end" />
          </Link>
        </nav>
        {staff && (
          <>
            <p className="nav-label views-label">YOUR VIEWS</p>
            <nav className="main-nav secondary-nav">
              <Link href={`/tickets?assigneeId=${user.id}`} onClick={closeMenu}>
                <UserRound size={18} />
                Assigned to me
              </Link>
              <Link href="/tickets?unassigned=true&status=OPEN" onClick={closeMenu}>
                <CircleHelp size={18} />
                Unassigned
              </Link>
            </nav>
          </>
        )}
        <div className="sidebar-assist">
          <span className="assist-icon">
            <Sparkles size={19} />
          </span>
          <strong>A little help. A lot of clarity.</strong>
          <p>Smart triage handles the first look. Your team makes the final call.</p>
          <Link href="/tickets/new" onClick={closeMenu}>
            Create a ticket
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="sidebar-profile">
          <Avatar name={user.name} />
          <div>
            <strong>{user.name}</strong>
            <span>{label(user.role)}</span>
          </div>
          <button
            className="icon-button logout-button"
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-label="Sign out"
          >
            {signingOut ? <Spinner small /> : <LogOut size={17} />}
          </button>
        </div>
        {logoutError && (
          <p className="sidebar-error" role="alert">
            {logoutError}
          </p>
        )}
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={mobile ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current}</strong>
          </div>
          <form className="global-search" role="search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              aria-label="Search all tickets"
              placeholder="Search tickets…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
            />
            <kbd aria-hidden="true">↵</kbd>
          </form>
          <span className="topbar-divider" />
          <Avatar name={user.name} small />
        </header>
        <main className="main-content" id="main-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Made for people who help people.</span>
          <span>
            <span className="footer-dot" />
            Relay support workspace
          </span>
        </footer>
      </div>
    </div>
  );
}
