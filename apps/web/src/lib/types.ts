export type Role = 'CUSTOMER' | 'AGENT' | 'ADMIN';
export type Status =
  'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Category = 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'GENERAL';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Person {
  id: string;
  name: string;
  email: string;
}
export interface Analysis {
  category: Category;
  priority: Priority;
  confidence: number;
  summary: string;
  suggestedReply: string;
  reasons: string[];
  modelVersion: string;
  source: string;
  analyzedAt: string;
  stale?: boolean;
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
  requester: Person;
  assignee: Person | null;
  version: number;
  aiAnalysis: Analysis | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
export interface TicketDetail extends Ticket {
  comments: { id: string; body: string; createdAt: string; author: Person }[];
  activities: {
    id: string;
    action: string;
    detail: string;
    createdAt: string;
    actor: Person;
  }[];
}
export interface TicketList {
  items: Ticket[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
export interface Stats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  urgent: number;
  unassigned: number;
  byStatus: { status: Status; count: number }[];
  byCategory: { category: Category; count: number }[];
}
export const STATUSES: Status[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];
export const CATEGORIES: Category[] = [
  'TECHNICAL',
  'BILLING',
  'ACCOUNT',
  'GENERAL',
];
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const transitions: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_CUSTOMER', 'RESOLVED'],
  WAITING_ON_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};
export function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
export function ticketNumber(n: number) {
  return `TK-${String(n).padStart(4, '0')}`;
}
export function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
export function date(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
export function dateTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
