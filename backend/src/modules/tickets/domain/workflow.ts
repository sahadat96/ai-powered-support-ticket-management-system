import type { TicketStatus } from './ticket';

const transitions: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};
export function allowedTransitions(status: TicketStatus, staff: boolean): TicketStatus[] {
  return transitions[status].filter(
    (next) =>
      staff || next === 'CLOSED' || (next === 'OPEN' && ['RESOLVED', 'CLOSED'].includes(status)),
  );
}
export function transitionError(
  current: TicketStatus,
  next: TicketStatus,
  staff: boolean,
  assigneeId: string | null,
): string | null {
  if (!allowedTransitions(current, staff).includes(next))
    return `Cannot change status from ${current} to ${next}`;
  if (['IN_PROGRESS', 'RESOLVED'].includes(next) && !assigneeId)
    return 'Assign a team member before starting or resolving work';
  return null;
}
