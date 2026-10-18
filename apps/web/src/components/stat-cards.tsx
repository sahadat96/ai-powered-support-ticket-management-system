'use client';
import { CheckCheck, CircleDot, Clock3, Ticket } from 'lucide-react';
import { Stats } from '@/lib/types';
export function StatCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: 'Total tickets',
      value: stats.total,
      icon: Ticket,
      footer: 'Every conversation, in one place',
    },
    {
      title: 'Open tickets',
      value: stats.open,
      icon: CircleDot,
      footer: `${stats.unassigned} active tickets unassigned`,
    },
    {
      title: 'In progress',
      value: stats.inProgress,
      icon: Clock3,
      footer: 'Including waiting on customer',
    },
    {
      title: 'Resolved',
      value: stats.resolved,
      icon: CheckCheck,
      footer: 'Resolved and closed conversations',
    },
  ];
  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div className="stat-card" key={card.title}>
          <div className="stat-top">
            {card.title}
            <span className="stat-icon">
              <card.icon size={14} />
            </span>
          </div>
          <div className="stat-value">{card.value.toLocaleString()}</div>
          <div className="stat-footer">{card.footer}</div>
        </div>
      ))}
    </div>
  );
}
