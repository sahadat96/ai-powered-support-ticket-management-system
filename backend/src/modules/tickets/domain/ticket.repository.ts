import {
  DashboardStats,
  Ticket,
  TicketCategory,
  TicketComment,
  TicketEvent,
  TicketPriority,
  TicketStatus,
  UserSummary,
} from './ticket';
import type { TriageResult } from '../../ai/domain/triage';

export interface TicketListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assigneeId?: string;
  requesterId?: string;
  unassigned?: boolean;
  sort?: 'newest' | 'oldest' | 'priority';
}
export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface CreateTicketRecord {
  title: string;
  description: string;
  requesterId: string;
  category: TicketCategory;
  priority: TicketPriority;
  ai: TriageResult;
}
export type TicketPatch = Partial<
  Pick<
    Ticket,
    | 'title'
    | 'description'
    | 'category'
    | 'priority'
    | 'assigneeId'
    | 'status'
    | 'ai'
    | 'resolvedAt'
  >
>;
export abstract class TicketRepository {
  abstract create(input: CreateTicketRecord, actorId: string): Promise<Ticket>;
  abstract findById(id: string): Promise<Ticket | null>;
  abstract list(query: TicketListQuery): Promise<TicketPage>;
  // Atomic optimistic version check, update, and event insertion in one transaction.
  abstract update(
    id: string,
    version: number,
    patch: TicketPatch,
    actorId: string,
    action: string,
    detail: string,
  ): Promise<Ticket | null>;
  abstract delete(id: string, version: number, actorId: string): Promise<boolean>;
  abstract comments(ticketId: string, includeInternal: boolean): Promise<TicketComment[]>;
  abstract addComment(
    ticketId: string,
    authorId: string,
    body: string,
    internal: boolean,
  ): Promise<TicketComment>;
  abstract events(ticketId: string): Promise<TicketEvent[]>;
  abstract stats(requesterId?: string): Promise<DashboardStats>;
  abstract findAgent(id: string): Promise<UserSummary | null>;
}
