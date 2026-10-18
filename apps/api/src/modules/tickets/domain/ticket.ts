import { Actor } from '../../users/domain/user';

export const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const CATEGORIES = ['BILLING', 'TECHNICAL', 'ACCOUNT', 'GENERAL'] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export interface Person { id: string; name: string; email: string }
export interface Ticket {
  id: string; number: number; title: string; description: string;
  status: Status; priority: Priority; category: Category;
  requesterId: string; assigneeId: string | null; version: number;
  aiAnalysis: unknown; createdAt: Date; updatedAt: Date; resolvedAt: Date | null;
  requester: Person; assignee: Person | null;
}
export interface Comment {id: string; body: string; createdAt: Date; author: Person}
export interface Activity {id: string; action: string; detail: string; createdAt: Date; actor: Person}
export interface TicketDetail extends Ticket { comments: Comment[]; activities: Activity[] }
export class TicketRuleError extends Error {
  constructor(message: string, public readonly code: 'FORBIDDEN' | 'CONFLICT') { super(message); }
}
export function canAccess(ticket: Pick<Ticket, 'requesterId'>, actor: Actor) {
  return actor.role !== 'CUSTOMER' || ticket.requesterId === actor.id;
}
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_CUSTOMER', 'RESOLVED'],
  WAITING_ON_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};
export function assertTransition(from: Status, to: Status, actor: Actor) {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) throw new TicketRuleError(`Cannot move a ticket from ${from} to ${to}.`, 'CONFLICT');
  if (actor.role === 'CUSTOMER' && !(from === 'RESOLVED' && (to === 'OPEN' || to === 'CLOSED'))) {
    throw new TicketRuleError('Customers can reopen or close resolved tickets. Other transitions require staff.', 'FORBIDDEN');
  }
}
export interface CreateTicket { title: string; description: string }
export interface UpdateTicket {
  version: number; title?: string; description?: string; status?: Status;
  category?: Category; priority?: Priority; assigneeId?: string | null;
}
export interface TicketQuery {
  page: number; limit: number; search?: string; status?: Status;
  priority?: Priority; category?: Category; assignedToMe?: boolean;
}
export interface TicketStats {
  total: number; open: number; inProgress: number; resolved: number; urgent: number; unassigned: number;
  byStatus: {status: Status; count: number}[];
  byCategory: {category: Category; count: number}[];
}
