'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { ErrorMessage, Spinner } from '@/components/ui';
import { TicketTable } from '@/components/ticket-table';
import { useQuery } from '@/lib/use-query';
import {
  CATEGORIES,
  label,
  PRIORITIES,
  STATUSES,
  TicketList,
} from '@/lib/types';

function Queue() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [debounced, setDebounced] = useState(search);
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [priority, setPriority] = useState(params.get('priority') ?? '');
  const [category, setCategory] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setSearch(params.get('search') ?? '');
    setStatus(params.get('status') ?? '');
    setPriority(params.get('priority') ?? '');
    setPage(1);
  }, [params]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const query = new URLSearchParams({ page: String(page), limit: '10' });
  if (debounced) query.set('search', debounced);
  if (status) query.set('status', status);
  if (priority) query.set('priority', priority);
  if (category) query.set('category', category);
  if (mine) query.set('assignedToMe', 'true');
  const result = useQuery<TicketList>(`/tickets?${query}`);
  const filtered = search || status || priority || category;
  function clear() {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategory('');
    setPage(1);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="heading-kicker">EVERY CONVERSATION MATTERS</span>
          <h1>Tickets</h1>
          <p>A shared space to turn questions into answers.</p>
        </div>
        <Link className="button primary" href="/tickets/new">
          <Plus size={14} />
          New ticket
        </Link>
      </div>
      <section className="panel">
        <div className="queue-toolbar">
          <div className="queue-tabs">
            <button
              className={`queue-tab ${!mine ? 'active' : ''}`}
              onClick={() => {
                setMine(false);
                setPage(1);
              }}
            >
              All tickets{' '}
              {!result.loading && !mine && (
                <span className="count-chip">{result.data?.total ?? 0}</span>
              )}
            </button>
            {user?.role !== 'CUSTOMER' && (
              <button
                className={`queue-tab ${mine ? 'active' : ''}`}
                onClick={() => {
                  setMine(true);
                  setPage(1);
                }}
              >
                Assigned to me
              </button>
            )}
          </div>
          <button
            className="icon-button"
            aria-label="Refresh tickets"
            onClick={result.refresh}
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <div className="queue-filters">
          <div className="queue-search">
            <Search size={14} />
            <input
              aria-label="Search tickets"
              placeholder="Search by subject, description, or ticket number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={120}
            />
          </div>
          <span className="filter-label">
            <ListFilter size={12} />
            Filter by
          </span>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              className="icon-button"
              aria-label="Clear filters"
              onClick={clear}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {result.loading ? (
          <Spinner text="Finding your conversations…" />
        ) : result.error ? (
          <div style={{ padding: 20 }}>
            <ErrorMessage message={result.error} retry={result.refresh} />
          </div>
        ) : (
          result.data && (
            <>
              <TicketTable tickets={result.data.items} />
              <div className="table-footer">
                <span>
                  {result.data.total
                    ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, result.data.total)}`
                    : '0'}{' '}
                  of {result.data.total} tickets
                </span>
                <div className="pagination">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span>
                    Page {page} of {Math.max(1, result.data.pages)}
                  </span>
                  <button
                    disabled={page >= result.data.pages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
export default function TicketsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Queue />
    </Suspense>
  );
}
