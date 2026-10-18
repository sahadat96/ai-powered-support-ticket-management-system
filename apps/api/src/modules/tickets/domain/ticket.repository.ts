import { Actor } from '../../users/domain/user';
import { CreateTicket, Ticket, TicketDetail, TicketQuery, TicketStats, UpdateTicket } from './ticket';

export type TicketChanges = Omit<UpdateTicket, 'version'> & {resolvedAt?: Date | null; aiAnalysis?: object};
export abstract class TicketRepository {
  abstract create(input: CreateTicket & {requesterId: string}): Promise<Ticket>;
  abstract findById(id: string): Promise<TicketDetail | null>;
  abstract list(actor: Actor, query: TicketQuery): Promise<{items: Ticket[]; total: number}>;
  abstract stats(actor: Actor): Promise<TicketStats>;
  abstract update(id: string, version: number, changes: TicketChanges, actorId: string, action: string, detail: string): Promise<Ticket | null>;
  abstract delete(id: string, version: number): Promise<boolean>;
  abstract addComment(id: string, version: number, body: string, actorId: string): Promise<boolean>;
}
