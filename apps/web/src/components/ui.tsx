'use client';
import { AlertCircle, LoaderCircle, Ticket as TicketIcon } from 'lucide-react';
import { label } from '@/lib/types';
export function Badge({
  value,
  kind = 'status',
}: {
  value: string;
  kind?: 'status' | 'priority' | 'category';
}) {
  return (
    <span className={`badge ${kind} ${value.toLowerCase()}`}>
      <span className="badge-dot" />
      {label(value)}
    </span>
  );
}
export function Spinner({
  text = 'Loading your workspace…',
}: {
  text?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{text}</span>
    </div>
  );
}
export function ErrorMessage({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title = 'No tickets here yet',
  description = 'Create a ticket or adjust your filters to get started.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <TicketIcon size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
