'use client';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { QueueChart } from '@/components/queue-chart';
import { StatCards } from '@/components/stat-cards';
import { TicketTable } from '@/components/ticket-table';
import { ErrorMessage, Spinner } from '@/components/ui';
import { useQuery } from '@/lib/use-query';
import { Stats, TicketList } from '@/lib/types';

export default function Dashboard() {
  const { user } = useAuth();
  const stats = useQuery<Stats>('/tickets/stats');
  const tickets = useQuery<TicketList>('/tickets?limit=6');
  if (stats.loading || tickets.loading) return <Spinner />;
  if (stats.error || tickets.error)
    return (
      <ErrorMessage
        message={stats.error || tickets.error}
        retry={() => {
          stats.refresh();
          tickets.refresh();
        }}
      />
    );
  if (!stats.data || !tickets.data) return null;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="heading-kicker">A CLEARER PICTURE</span>
          <h1>
            Hello, {user?.name.split(' ')[0]}{' '}
            <span style={{ fontWeight: 400, color: '#b3a2d8' }}>✳</span>
          </h1>
          <p>Here’s what’s happening in your support workspace.</p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">
            <CalendarDays size={13} />
            {new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'Asia/Dhaka',
            })}
          </span>
          <Link href="/tickets/new" className="button primary">
            <Plus size={14} />
            New ticket
          </Link>
        </div>
      </div>
      <StatCards stats={stats.data} />
      {stats.data.urgent > 0 && (
        <div className="attention-banner">
          <CircleAlert size={15} />
          <span>
            <strong>
              {stats.data.urgent} urgent{' '}
              {stats.data.urgent === 1 ? 'ticket needs' : 'tickets need'}
            </strong>{' '}
            a little extra attention.
          </span>
          <Link href="/tickets?priority=URGENT">
            Take a look
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
      <div className="section-title">Your workspace, at a glance</div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Recent tickets
                <span className="count-chip">{tickets.data.total}</span>
              </h2>
              <p>The latest conversations coming your way.</p>
            </div>
            <Link href="/tickets" className="text-button">
              View all tickets
              <ArrowUpRight size={12} />
            </Link>
          </div>
          <TicketTable tickets={tickets.data.items} compact />
          <div className="table-footer">
            <span>
              Showing the latest {tickets.data.items.length} of{' '}
              {tickets.data.total} tickets
            </span>
            <span className="mini-status">
              <span className="live-dot" />
              Live workspace data
            </span>
          </div>
        </section>
        <div className="dashboard-secondary">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>A little perspective</h2>
                <p>Tickets by category</p>
              </div>
              <span className="count-chip">All time</span>
            </div>
            <QueueChart stats={stats.data} />
          </section>
          <div className="ai-banner">
            <span className="ai-orb">
              <Sparkles size={19} />
            </span>
            <div>
              <h3>Less sorting. More solving.</h3>
              <p>
                Let AI suggest a starting point.
                <br />
                Your team makes the final call.
              </p>
            </div>
            <Link className="text-button" href="/guide#ai">
              Meet your assistant
              <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </div>
      <div className="bottom-note">
        <span>
          <ShieldCheck size={11} />
          Every conversation has a way forward.
        </span>
        <span>Made for a more human kind of support.</span>
      </div>
    </>
  );
}
