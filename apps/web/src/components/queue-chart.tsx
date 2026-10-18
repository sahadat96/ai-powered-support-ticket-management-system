'use client';
import { CATEGORIES, label, Stats } from '@/lib/types';
const colors = ['#a797d4', '#b5c7e5', '#ddc5a5', '#b6d6c8'];
export function QueueChart({stats}: {stats: Stats}) {
  let offset = 0;
  const segments = CATEGORIES.map((category, i) => {const value = stats.byCategory.find(c => c.category === category)?.count ?? 0; const start = offset; offset += stats.total ? value / stats.total * 100 : 0; return `${colors[i]} ${start}% ${offset}%`;});
  return <div className="queue-chart"><div className="donut" role="img" aria-label={`${stats.total} tickets by category`} style={{background: stats.total ? `conic-gradient(${segments.join(',')})` : '#f0edf5'}}><div className="donut-inner"><strong>{stats.total}</strong><span>Total tickets</span></div></div><div className="chart-legend">{CATEGORIES.map((category, i) => <div key={category} className="legend-row"><span className="legend-dot" style={{background: colors[i]}}/>{label(category)}<strong>{stats.byCategory.find(c => c.category === category)?.count ?? 0}</strong></div>)}</div></div>;
}
