'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, Circle, Filter, Plus, Search, SlidersHorizontal, Ticket as TicketIcon, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Avatar, CategoryBadge, EmptyState, ErrorState, LoadingState, PageHeading, PriorityBadge, StatusBadge } from '@/components/ui';
import { formatDate, label, relativeTime, ticketNumber } from '@/lib/format';
import { CATEGORIES, PRIORITIES, STATUSES, type TicketPage, type User } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import styles from '@/components/tickets-list.module.css';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function TicketsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'AGENT';
  const urlSearch = (searchParams.get('search') ?? '').slice(0, 100);
  const [search, setSearch] = useState(urlSearch);
  const status = STATUSES.find(value => value === searchParams.get('status')) ?? '';
  const category = CATEGORIES.find(value => value === searchParams.get('category')) ?? '';
  const priority = PRIORITIES.find(value => value === searchParams.get('priority')) ?? '';
  const sort = ['newest', 'oldest', 'priority'].includes(searchParams.get('sort') ?? '') ? searchParams.get('sort')! : 'newest';
  const rawPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1_000_000 ? rawPage : 1;
  const rawLimit = Number(searchParams.get('limit') ?? '10');
  const limit = [10, 25, 50].includes(rawLimit) ? rawLimit : 10;
  const assigneeParam = searchParams.get('assigneeId') ?? '';
  const assigneeId = uuid.test(assigneeParam) ? assigneeParam : '';
  const unassigned = searchParams.get('unassigned') === 'true';
  const assignment = unassigned ? '__unassigned' : assigneeId;

  const updateQuery = useCallback((changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => {
    if (search.trim() === urlSearch) return;
    const timer = window.setTimeout(() => updateQuery({ search: search.trim() }), 350);
    return () => window.clearTimeout(timer);
  }, [search, updateQuery, urlSearch]);

  const path = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    if (urlSearch) query.set('search', urlSearch);
    if (status) query.set('status', status);
    if (priority) query.set('priority', priority);
    if (category) query.set('category', category);
    if (assigneeId && !unassigned) query.set('assigneeId', assigneeId);
    if (unassigned) query.set('unassigned', 'true');
    return `/tickets?${query.toString()}`;
  }, [page, limit, sort, urlSearch, status, priority, category, assigneeId, unassigned]);
  const { data, loading, error, reload } = useResource<TicketPage>(path);
  const { data: agents } = useResource<{ items: User[] }>(staff ? '/users/agents' : null);
  const filtered = Boolean(urlSearch || status || category || priority || assigneeId || unassigned);
  const hasMoreFilters = Boolean(category || priority || assigneeId || unassigned || urlSearch);

  function clearFilters() {
    setSearch('');
    updateQuery({ search: null, status: null, category: null, priority: null, assigneeId: null, unassigned: null });
  }

  return <>
    <PageHeading title="Tickets" description={staff ? 'Every conversation, in one place. Keep the right work moving.' : 'Your questions, updates, and conversations with our support team.'}
      action={<Link href="/tickets/new" className="btn btn-primary"><Plus size={17} />New ticket</Link>} />

    <section className={`card ${styles.listCard}`} aria-label="Support tickets">
      <div className={styles.cardHeading}>
        <div className={styles.cardTitle}><span className={styles.headingIcon}><TicketIcon size={18} /></span><h2>{user?.role === 'CUSTOMER' ? 'Your tickets' : 'All tickets'}</h2>
          {data && !loading && <span className={styles.count}>{data.total}</span>}</div>
        <span className={styles.liveLabel}><span />{user?.role === 'CUSTOMER' ? 'Your support workspace' : 'Team workspace'}</span>
      </div>

      <nav className={styles.tabs} aria-label="Filter tickets by status">
        <button type="button" className={`${styles.tab} ${!status ? styles.tabActive : ''}`} aria-pressed={!status} onClick={() => updateQuery({ status: null })}>All tickets</button>
        {STATUSES.map(value => <button type="button" key={value} aria-pressed={status === value}
          className={`${styles.tab} ${status === value ? styles.tabActive : ''}`} onClick={() => updateQuery({ status: value })}>
          <Circle size={8} className={`${styles.tabDot} ${styles[`dot${value}`]}`} fill="currentColor" />{label(value)}
        </button>)}
      </nav>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}><Search size={17} aria-hidden="true" /><label htmlFor="ticket-search" className="sr-only">Search tickets</label>
          <input id="ticket-search" type="search" maxLength={100} placeholder="Search by title, description, or ticket number…" value={search}
            onChange={event => setSearch(event.target.value)} autoComplete="off" />
          {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); updateQuery({ search: null }); }}><X size={15} /></button>}
        </div>
        <div className={styles.sortControl}><ArrowDownWideNarrow size={15} aria-hidden="true" /><label htmlFor="ticket-sort" className="sr-only">Sort tickets</label>
          <select id="ticket-sort" value={sort} onChange={event => updateQuery({ sort: event.target.value === 'newest' ? null : event.target.value })}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Priority first</option>
          </select>
        </div>
      </div>

      <div className={styles.filterBar}>
        <span className={styles.filterLabel}><SlidersHorizontal size={14} />Filters</span>
        <label className="sr-only" htmlFor="priority-filter">Filter by priority</label>
        <select id="priority-filter" className={styles.filterSelect} value={priority} onChange={event => updateQuery({ priority: event.target.value })}>
          <option value="">All priorities</option>{PRIORITIES.map(value => <option value={value} key={value}>{label(value)}</option>)}
        </select>
        <label className="sr-only" htmlFor="category-filter">Filter by category</label>
        <select id="category-filter" className={styles.filterSelect} value={category} onChange={event => updateQuery({ category: event.target.value })}>
          <option value="">All categories</option>{CATEGORIES.map(value => <option value={value} key={value}>{label(value)}</option>)}
        </select>
        {staff && <><label className="sr-only" htmlFor="assignee-filter">Filter by assignee</label>
          <select id="assignee-filter" className={styles.filterSelect} value={assignment} onChange={event => updateQuery({ assigneeId: event.target.value === '__unassigned' ? null : event.target.value, unassigned: event.target.value === '__unassigned' ? 'true' : null })}>
            <option value="">All assignees</option><option value="__unassigned">Unassigned</option>
            {assigneeId && !agents?.items.some(agent => agent.id === assigneeId) && <option value={assigneeId}>Selected team member</option>}
            {agents?.items.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.id === user?.id ? ' (you)' : ''}</option>)}
          </select></>}
        {filtered && <button type="button" className={styles.clearButton} onClick={clearFilters}><X size={13} />Clear filters</button>}
        {hasMoreFilters && <span className={styles.filteredHint}><Filter size={12} />Filtered view</span>}
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">{loading ? 'Loading tickets' : error ? 'Tickets could not be loaded' : `${data?.total ?? 0} tickets found`}</div>
      {loading ? <div className={styles.loading}><LoadingState rows={5} /></div> : error ? <div className={styles.loading}><ErrorState message={error} retry={reload} /></div> : data?.items.length ? <>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className="sr-only">Support tickets matching the current filters</caption>
            <thead><tr><th scope="col">Ticket</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Category</th><th scope="col">Assigned to</th><th scope="col">Updated</th></tr></thead>
            <tbody>{data.items.map(ticket => <tr key={ticket.id}>
              <td className={styles.ticketCell}><div className={styles.ticketMeta}><span>{ticketNumber(ticket.number)}</span><span className={styles.metaDot}>·</span><span>{ticket.requester?.name ?? 'Customer'}</span></div>
                <Link href={`/tickets/${ticket.id}`} className={styles.ticketTitle}>{ticket.title}</Link>
                <p className={styles.ticketDescription}>{ticket.description}</p>
              </td>
              <td><StatusBadge status={ticket.status} /></td><td><PriorityBadge priority={ticket.priority} /></td>
              <td><CategoryBadge category={ticket.category} /></td>
              <td>{ticket.assignee ? <span className={styles.assignee}><Avatar name={ticket.assignee.name} small /><span>{ticket.assignee.name}</span></span> : <span className={styles.unassigned}><span className={styles.emptyAvatar}>–</span>Unassigned</span>}</td>
              <td><time dateTime={ticket.updatedAt} title={formatDate(ticket.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })} className={styles.updated}>{relativeTime(ticket.updatedAt)}</time></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>Showing <strong>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)}</strong> of <strong>{data.total}</strong> tickets</span>
          <div className={styles.pageControls}>
            <label htmlFor="tickets-per-page">Per page</label><select id="tickets-per-page" value={limit} onChange={event => updateQuery({ limit: event.target.value })}>{[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select>
            <button type="button" className={styles.pageButton} disabled={data.page <= 1} aria-label="Previous page" onClick={() => updateQuery({ page: String(data.page - 1) }, false)}><ChevronLeft size={16} /></button>
            <span className={styles.pageNumber}>{data.page} <span>/ {data.totalPages}</span></span>
            <button type="button" className={styles.pageButton} disabled={data.page >= data.totalPages} aria-label="Next page" onClick={() => updateQuery({ page: String(data.page + 1) }, false)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </> : <EmptyState title={filtered ? 'No matching tickets' : page > 1 ? 'No tickets on this page' : 'A fresh start for your inbox'}
        description={filtered ? 'Try another search or clear your filters to see more conversations.' : page > 1 ? 'Go back to the first page to see your tickets.' : 'Create your first ticket and let smart triage help get it to the right place.'}
        action={filtered ? <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button> : page > 1 ? <button type="button" className="btn btn-secondary" onClick={() => updateQuery({ page: null })}>Go to first page</button> : <Link href="/tickets/new" className="btn btn-primary"><Plus size={16} />Create a ticket</Link>} />}
    </section>
    <p className={styles.footerNote}>Good support starts with a conversation.</p>
  </>;
}

export default function TicketsPage() {
  return <Suspense fallback={<LoadingState rows={6} />}><TicketsContent /></Suspense>;
}
