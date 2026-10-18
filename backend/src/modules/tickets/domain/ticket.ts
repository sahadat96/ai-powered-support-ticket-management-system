import type { TriageResult } from '../../ai/domain/triage';

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_CATEGORIES = ['BILLING', 'TECHNICAL', 'ACCOUNT', 'GENERAL'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}
export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  requesterId: string;
  assigneeId: string | null;
  requester?: UserSummary;
  assignee?: UserSummary | null;
  ai: TriageResult;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}
export interface TicketComment {
  id: string;
  ticketId: string;
  body: string;
  internal: boolean;
  authorId: string;
  author?: UserSummary;
  createdAt: Date;
}
export interface TicketEvent {
  id: string;
  ticketId: string;
  actorId: string;
  actor?: UserSummary;
  action: string;
  detail: string;
  createdAt: Date;
}
export interface DashboardStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  unassigned: number;
  byCategory: { category: TicketCategory; count: number }[];
  byPriority: { priority: TicketPriority; count: number }[];
  dailyCreated: { date: string; count: number }[];
}
