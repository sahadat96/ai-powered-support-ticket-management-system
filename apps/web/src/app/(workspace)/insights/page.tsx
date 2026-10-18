'use client';
import { BarChart3 } from 'lucide-react';
import { useQuery } from '@/lib/use-query';
import { label, Stats, STATUSES } from '@/lib/types';
import { Spinner, ErrorMessage } from '@/components/ui';
import { StatCards } from '@/components/stat-cards';
import { QueueChart } from '@/components/queue-chart';

export default function InsightsPage() {
  const { data, error, loading, refresh } = useQuery<Stats>('/tickets/stats');
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage message={error} retry={refresh} />;
  if (!data) return null;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="heading-kicker">STEP BACK. SEE THE PICTURE.</span>
          <h1>Support insights</h1>
          <p>
            A live look at your conversations, from first question to final
            answer.
          </p>
        </div>
        <span className="date-chip">
          <BarChart3 size={13} />
          All time
        </span>
      </div>
      <StatCards stats={data} />
      <div className="insight-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Where things stand</h2>
              <p>Every stage of the support journey.</p>
            </div>
          </div>
          <div className="status-breakdown">
            {STATUSES.map((status) => {
              const count =
                data.byStatus.find((s) => s.status === status)?.count ?? 0;
              return (
                <div className="status-breakdown-row" key={status}>
                  <div className="breakdown-label">
                    <span>{label(status)}</span>
                    <strong>
                      {count}{' '}
                      <span className="muted">
                        ·{' '}
                        {data.total
                          ? Math.round((count / data.total) * 100)
                          : 0}
                        %
                      </span>
                    </strong>
                  </div>
                  <div className="breakdown-bar">
                    <span
                      style={{
                        width: `${data.total ? (count / data.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>What people need help with</h2>
              <p>Category distribution across your tickets.</p>
            </div>
          </div>
          <QueueChart stats={data} />
        </section>
      </div>
      <div className="ai-banner">
        <div>
          <h3>{data.unassigned} active tickets are waiting for an owner.</h3>
          <p>
            {data.urgent} active tickets are marked urgent. Statistics follow
            the same access rules as your ticket queue.
          </p>
        </div>
      </div>
    </>
  );
}
