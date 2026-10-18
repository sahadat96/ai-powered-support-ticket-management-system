import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { Actor } from '../../users/domain/user';
import { CreateTicket, TicketQuery, TicketStats } from '../domain/ticket';
import { TicketChanges, TicketRepository } from '../domain/ticket.repository';

const person = {id: true, name: true, email: true} as const;
const include = {requester: {select: person}, assignee: {select: person}};

@Injectable()
export class PrismaTicketRepository extends TicketRepository {
  constructor(private readonly prisma: PrismaService) { super(); }
  create(input: CreateTicket & {requesterId: string}) {
    return this.prisma.ticket.create({data: {...input, activities: {create: {actorId: input.requesterId, action: 'CREATED', detail: 'Ticket submitted'}}}, include});
  }
  findById(id: string) {
    return this.prisma.ticket.findUnique({where: {id}, include: {...include, comments: {include: {author: {select: person}}, orderBy: {createdAt: 'asc'}}, activities: {include: {actor: {select: person}}, orderBy: {createdAt: 'desc'}}}});
  }
  async list(actor: Actor, query: TicketQuery) {
    const where: Prisma.TicketWhereInput = {
      ...(actor.role === 'CUSTOMER' ? {requesterId: actor.id} : {}),
      ...(query.assignedToMe ? {assigneeId: actor.id} : {}),
      status: query.status, priority: query.priority, category: query.category,
      ...(query.search ? {OR: [{title: {contains: query.search, mode: 'insensitive'}}, {description: {contains: query.search, mode: 'insensitive'}}, ...(/^\d+$/.test(query.search) && Number(query.search) <= 2147483647 ? [{number: Number(query.search)}] : [])]} : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({where, include, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], skip: (query.page - 1) * query.limit, take: query.limit}),
      this.prisma.ticket.count({where}),
    ], {isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead});
    return {items, total};
  }
  async stats(actor: Actor): Promise<TicketStats> {
    const where: Prisma.TicketWhereInput = actor.role === 'CUSTOMER' ? {requesterId: actor.id} : {};
    const active = {notIn: ['RESOLVED', 'CLOSED'] as ('RESOLVED' | 'CLOSED')[]};
    return this.prisma.$transaction(async tx => {
      const statuses = await tx.ticket.groupBy({by: ['status'], where, _count: {_all: true}});
      const categories = await tx.ticket.groupBy({by: ['category'], where, _count: {_all: true}});
      const urgent = await tx.ticket.count({where: {...where, status: active, priority: 'URGENT'}});
      const unassigned = await tx.ticket.count({where: {...where, status: active, assigneeId: null}});
      const count = (status: string) => statuses.find(r => r.status === status)?._count._all ?? 0;
      return {total: statuses.reduce((sum, r) => sum + r._count._all, 0), open: count('OPEN'), inProgress: count('IN_PROGRESS') + count('WAITING_ON_CUSTOMER'), resolved: count('RESOLVED') + count('CLOSED'), urgent, unassigned, byStatus: statuses.map(r => ({status: r.status, count: r._count._all})), byCategory: categories.map(r => ({category: r.category, count: r._count._all}))};
    }, {isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  async update(id: string, version: number, changes: TicketChanges, actorId: string, action: string, detail: string) {
    return this.prisma.$transaction(async tx => {
      const {aiAnalysis, ...rest} = changes;
      const result = await tx.ticket.updateMany({where: {id, version}, data: {...rest, ...(aiAnalysis === undefined ? {} : {aiAnalysis: aiAnalysis as Prisma.InputJsonValue}), version: {increment: 1}}});
      if (result.count !== 1) return null;
      await tx.activity.create({data: {ticketId: id, actorId, action, detail}});
      return tx.ticket.findUniqueOrThrow({where: {id}, include});
    });
  }
  async delete(id: string, version: number) { return (await this.prisma.ticket.deleteMany({where: {id, version}})).count === 1; }
  async addComment(id: string, version: number, body: string, actorId: string) {
    return this.prisma.$transaction(async tx => {
      const result = await tx.ticket.updateMany({where: {id, version, status: {not: 'CLOSED'}}, data: {version: {increment: 1}}});
      if (result.count !== 1) return false;
      await tx.comment.create({data: {ticketId: id, authorId: actorId, body}});
      await tx.activity.create({data: {ticketId: id, actorId, action: 'COMMENTED', detail: 'Added a reply'}});
      return true;
    });
  }
}
