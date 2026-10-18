export type Role = 'CUSTOMER' | 'AGENT' | 'ADMIN';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const CATEGORIES = ['BILLING', 'TECHNICAL', 'ACCOUNT', 'GENERAL'] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Triage {
  category: Category;
  priority: Priority;
  confidence: number;
  summary: string;
  suggestedReply: string;
  explanation: string[];
  modelVersion: string;
  provider: string;
}
export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  category: Category;
  requesterId: string;
  assigneeId: string | null;
  requester?: User;
  assignee?: User | null;
  ai: Triage;
  version: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  author?: User;
  body: string;
  internal: boolean;
  createdAt: string;
}
export interface TicketEvent {
  id: string;
  actor?: User;
  actorId: string;
  action: string;
  detail: string;
  createdAt: string;
}
export interface TicketDetail {
  ticket: Ticket;
  comments: TicketComment[];
  events: TicketEvent[];
  allowedTransitions: Status[];
}
export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  unassigned: number;
  byCategory: { category: Category; count: number }[];
  byPriority: { priority: Priority; count: number }[];
  dailyCreated: { date: string; count: number }[];
}
