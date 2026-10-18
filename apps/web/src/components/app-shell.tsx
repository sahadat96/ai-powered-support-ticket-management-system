'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  Layers2,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { useAuth } from './auth-provider';
import { ErrorMessage, Spinner } from './ui';
import { initials, label } from '@/lib/types';

const navigation = [
  { href: '/dashboard', name: 'Overview', icon: LayoutDashboard },
  { href: '/tickets', name: 'All tickets', icon: Ticket },
  { href: '/insights', name: 'Insights', icon: BarChart3 },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, error, reload, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (!loading && !user && !error) router.replace('/login');
  }, [loading, user, error, router]);
  useEffect(() => setMobile(false), [pathname]);
  useEffect(() => {
    if (!mobile) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobile]);
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="standalone-state">
        <ErrorMessage message={error} retry={reload} />
      </div>
    );
  if (!user) return <Spinner text="Taking you to sign in…" />;
  const current = pathname.startsWith('/tickets')
    ? 'Tickets'
    : pathname === '/insights'
      ? 'Insights'
      : pathname === '/guide'
        ? 'Workspace guide'
        : 'Overview';
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobile ? 'mobile-open' : ''}`}
      >
        <Link className="brand" href="/dashboard">
          <span className="brand-icon">
            <Layers2 size={21} />
          </span>
          relay<span className="brand-period">.</span>
        </Link>
        <div className="workspace-selector">
          <span className="workspace-square">S</span>
          <div>
            <strong>Support workspace</strong>
            <small>{label(user.role)} access</small>
          </div>
          <ChevronsUpDown size={12} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              <item.icon />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="nav-label">RESOURCES</p>
          <Link
            className={`nav-link ${pathname === '/guide' ? 'active' : ''}`}
            href="/guide"
          >
            <BookOpen />
            Workspace guide
          </Link>
          <a
            className="nav-link"
            href="http://localhost:4000/docs"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp />
            API documentation
            <ArrowUpRight size={12} style={{ marginLeft: 'auto' }} />
          </a>
          <div className="sidebar-ai">
            <div className="sidebar-ai-head">
              <Sparkles size={14} />A little help from AI
            </div>
            <p>
              Thoughtful suggestions.
              <br />
              Your team stays in control.
            </p>
          </div>
          <div className="sidebar-footer">
            <span>
              <span className="live-dot" />
              Local intelligence
            </span>
            <span>RELAY v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="menu-toggle icon-button"
            aria-label="Open navigation"
            aria-expanded={mobile}
            aria-controls="workspace-navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={11} />
            <strong>{current}</strong>
            {pathname === '/tickets/new' && (
              <>
                <ChevronRight size={11} />
                <strong>New ticket</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                router.push(
                  `/tickets?search=${encodeURIComponent(String(data.get('search')))}`,
                );
              }}
            >
              <Search size={13} />
              <input
                name="search"
                aria-label="Search all tickets"
                placeholder="Search anything…"
                maxLength={120}
              />
            </form>
            <span className="topbar-divider" />
            <div className="user-menu">
              <span className="avatar">{initials(user.name)}</span>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{label(user.role)}</div>
              </div>
              <button
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  setLogoutError('');
                  try {
                    await signOut();
                  } catch (e) {
                    setLogoutError((e as Error).message);
                  } finally {
                    setSigningOut(false);
                  }
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>
        <main className="content">
          {logoutError && <ErrorMessage message={logoutError} />}
          {children}
        </main>
      </div>
    </div>
  );
}
