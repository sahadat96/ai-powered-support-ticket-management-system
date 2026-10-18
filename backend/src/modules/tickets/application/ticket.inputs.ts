import type {TicketCategory, TicketPriority, TicketStatus} from '../domain/ticket';

export interface CreateTicketInput {title: string; description: string; category?: TicketCategory; priority?: TicketPriority}
export interface UpdateTicketInput {version: number; title?: string; description?: string; category?: TicketCategory; priority?: TicketPriority; assigneeId?: string | null}
export interface ChangeStatusInput {version: number; status: TicketStatus}
export interface CreateCommentInput {body: string; internal?: boolean}
export interface AnalyzeTicketInput {version: number; apply?: boolean}
