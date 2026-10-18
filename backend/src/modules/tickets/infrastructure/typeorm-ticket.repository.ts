import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../../users/domain/user';
import { UserOrmEntity } from '../../users/infrastructure/user.orm-entity';
import {
  DashboardStats, Ticket, TicketComment, TicketEvent, TICKET_CATEGORIES, TICKET_PRIORITIES, UserSummary,
} from '../domain/ticket';
import {
  CreateTicketRecord, TicketListQuery, TicketPage, TicketPatch, TicketRepository,
} from '../domain/ticket.repository';
import { CommentOrmEntity } from './comment.orm-entity';
import { EventOrmEntity } from './event.orm-entity';
import { TicketOrmEntity } from './ticket.orm-entity';

function userSummary(user: UserOrmEntity): UserSummary {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function toTicket(entity: TicketOrmEntity): Ticket {
  return {
    id: entity.id, number: entity.number, title: entity.title, description: entity.description,
    status: entity.status, priority: entity.priority, category: entity.category,
    requesterId: entity.requesterId, assigneeId: entity.assigneeId,
    requester: entity.requester ? userSummary(entity.requester) : undefined,
    assignee: entity.assignee ? userSummary(entity.assignee) : null,
    ai: entity.ai, version: entity.version, createdAt: entity.createdAt,
    updatedAt: entity.updatedAt, resolvedAt: entity.resolvedAt,
  };
}

function toComment(entity: CommentOrmEntity): TicketComment {
  return {
    id: entity.id, ticketId: entity.ticketId, body: entity.body, internal: entity.internal,
    authorId: entity.authorId, author: entity.author ? userSummary(entity.author) : undefined,
    createdAt: entity.createdAt,
  };
}

function toEvent(entity: EventOrmEntity): TicketEvent {
  return {
    id: entity.id, ticketId: entity.ticketId, actorId: entity.actorId,
    actor: entity.actor ? userSummary(entity.actor) : undefined, action: entity.action,
    detail: entity.detail, createdAt: entity.createdAt,
  };
}

@Injectable()
export class TypeOrmTicketRepository extends TicketRepository {
  constructor(private readonly dataSource: DataSource) { super(); }

  private tickets(manager: EntityManager = this.dataSource.manager): SelectQueryBuilder<TicketOrmEntity> {
    return manager.getRepository(TicketOrmEntity).createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.requester', 'requester')
      .leftJoinAndSelect('ticket.assignee', 'assignee')
      .where('ticket.deleted_at IS NULL');
  }

  private async read(manager: EntityManager, id: string): Promise<Ticket | null> {
    const record = await this.tickets(manager).andWhere('ticket.id = :id', { id }).getOne();
    return record ? toTicket(record) : null;
  }

  async create(input: CreateTicketRecord, actorId: string): Promise<Ticket> {
    return this.dataSource.transaction(async manager => {
      const repository = manager.getRepository(TicketOrmEntity);
      const record = await repository.save(repository.create({
        ...input, status: 'OPEN', assigneeId: null, resolvedAt: null, deletedAt: null, version: 1,
      }));
      await manager.getRepository(EventOrmEntity).insert({
        ticketId: record.id, actorId, action: 'CREATED', detail: 'Ticket created and automatically triaged',
      });
      return (await this.read(manager, record.id))!;
    });
  }

  findById(id: string): Promise<Ticket | null> {
    return this.read(this.dataSource.manager, id);
  }

  async list(query: TicketListQuery): Promise<TicketPage> {
    const builder = this.tickets();
    if (query.requesterId) builder.andWhere('ticket.requester_id = :requesterId', { requesterId: query.requesterId });
    if (query.status) builder.andWhere('ticket.status = :status', { status: query.status });
    if (query.priority) builder.andWhere('ticket.priority = :priority', { priority: query.priority });
    if (query.category) builder.andWhere('ticket.category = :category', { category: query.category });
    if (query.assigneeId) builder.andWhere('ticket.assignee_id = :assigneeId', { assigneeId: query.assigneeId });
    if (query.unassigned) builder.andWhere('ticket.assignee_id IS NULL');
    if (query.search?.trim()) {
      // Treat %, _ and backslash as literal search characters. Values remain parameterized.
      const search = `%${query.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      builder.andWhere('(ticket.title ILIKE :search OR ticket.description ILIKE :search OR CAST(ticket.number AS text) ILIKE :search)', { search });
    }
    if (query.sort === 'priority') {
      builder.addSelect("CASE ticket.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END", 'priority_order')
        .orderBy('priority_order', 'ASC').addOrderBy('ticket.created_at', 'DESC');
    } else {
      builder.orderBy('ticket.created_at', query.sort === 'oldest' ? 'ASC' : 'DESC');
    }
    builder.addOrderBy('ticket.id', 'ASC');
    const [records, total] = await builder.skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return {
      items: records.map(toTicket), total, page: query.page, limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async update(id: string, version: number, patch: TicketPatch, actorId: string, action: string, detail: string): Promise<Ticket | null> {
    return this.dataSource.transaction(async manager => {
      const result = await manager.getRepository(TicketOrmEntity).createQueryBuilder()
        .update(TicketOrmEntity)
        .set({ ...patch, version: version + 1, updatedAt: () => 'CURRENT_TIMESTAMP' })
        .where('id = :id AND version = :version AND deleted_at IS NULL', { id, version }).execute();
      if (!result.affected) return null;
      await manager.getRepository(EventOrmEntity).insert({ ticketId: id, actorId, action, detail });
      return this.read(manager, id);
    });
  }

  async delete(id: string, version: number, actorId: string): Promise<boolean> {
    return this.dataSource.transaction(async manager => {
      const result = await manager.getRepository(TicketOrmEntity).createQueryBuilder()
        .update(TicketOrmEntity)
        .set({ deletedAt: () => 'CURRENT_TIMESTAMP', updatedAt: () => 'CURRENT_TIMESTAMP', version: version + 1 })
        .where('id = :id AND version = :version AND deleted_at IS NULL', { id, version }).execute();
      if (!result.affected) return false;
      await manager.getRepository(EventOrmEntity).insert({
        ticketId: id, actorId, action: 'DELETED', detail: 'Ticket archived; conversation and audit history retained',
      });
      return true;
    });
  }

  async comments(ticketId: string, includeInternal: boolean): Promise<TicketComment[]> {
    const builder = this.dataSource.getRepository(CommentOrmEntity).createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.ticket_id = :ticketId', { ticketId })
      .orderBy('comment.created_at', 'ASC').addOrderBy('comment.id', 'ASC');
    if (!includeInternal) builder.andWhere('comment.internal = false');
    return (await builder.getMany()).map(toComment);
  }

  async addComment(ticketId: string, authorId: string, body: string, internal: boolean): Promise<TicketComment> {
    return this.dataSource.transaction(async manager => {
      // Serialize against status changes and archival so a closed/deleted ticket cannot receive a late comment.
      const ticket = await manager.getRepository(TicketOrmEntity).createQueryBuilder('ticket')
        .setLock('pessimistic_write').where('ticket.id = :ticketId AND ticket.deleted_at IS NULL', { ticketId }).getOne();
      if (!ticket || ticket.status === 'CLOSED') {
        throw new ConflictException('This ticket has been closed or removed. Refresh before replying.');
      }
      const repository = manager.getRepository(CommentOrmEntity);
      const comment = await repository.save(repository.create({ ticketId, authorId, body, internal }));
      await manager.getRepository(TicketOrmEntity).update(ticketId, { updatedAt: new Date() });
      await manager.getRepository(EventOrmEntity).insert({
        ticketId, actorId: authorId, action: internal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
        detail: internal ? 'A team member added an internal note' : 'A reply was added to the conversation',
      });
      const hydrated = await repository.findOneOrFail({ where: { id: comment.id }, relations: { author: true } });
      return toComment(hydrated);
    });
  }

  async events(ticketId: string): Promise<TicketEvent[]> {
    const records = await this.dataSource.getRepository(EventOrmEntity).find({
      where: { ticketId }, relations: { actor: true }, order: { createdAt: 'ASC', id: 'ASC' },
    });
    return records.map(toEvent);
  }

  async stats(requesterId?: string): Promise<DashboardStats> {
    const scope = () => {
      const builder = this.dataSource.getRepository(TicketOrmEntity).createQueryBuilder('ticket')
        .where('ticket.deleted_at IS NULL');
      if (requesterId) builder.andWhere('ticket.requester_id = :requesterId', { requesterId });
      return builder;
    };
    const firstDay = new Date();
    firstDay.setUTCHours(0, 0, 0, 0);
    firstDay.setUTCDate(firstDay.getUTCDate() - 6);
    const [counts, categories, priorities, daily] = await Promise.all([
      scope().select('COUNT(*)', 'total')
        .addSelect("COUNT(*) FILTER (WHERE ticket.status = 'OPEN')", 'open')
        .addSelect("COUNT(*) FILTER (WHERE ticket.status = 'IN_PROGRESS')", 'inProgress')
        .addSelect("COUNT(*) FILTER (WHERE ticket.status = 'RESOLVED')", 'resolved')
        .addSelect("COUNT(*) FILTER (WHERE ticket.status = 'CLOSED')", 'closed')
        .addSelect('COUNT(*) FILTER (WHERE ticket.assignee_id IS NULL)', 'unassigned').getRawOne<Record<string, string>>(),
      scope().select('ticket.category', 'category').addSelect('COUNT(*)', 'count').groupBy('ticket.category')
        .getRawMany<{ category: string; count: string }>(),
      scope().select('ticket.priority', 'priority').addSelect('COUNT(*)', 'count').groupBy('ticket.priority')
        .getRawMany<{ priority: string; count: string }>(),
      scope().select("to_char(ticket.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count').andWhere('ticket.created_at >= :firstDay', { firstDay })
        .groupBy("to_char(ticket.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')")
        .getRawMany<{ date: string; count: string }>(),
    ]);
    return {
      total: Number(counts?.total ?? 0), open: Number(counts?.open ?? 0),
      inProgress: Number(counts?.inProgress ?? 0), resolved: Number(counts?.resolved ?? 0),
      closed: Number(counts?.closed ?? 0), unassigned: Number(counts?.unassigned ?? 0),
      byCategory: TICKET_CATEGORIES.map(category => ({ category, count: Number(categories.find(row => row.category === category)?.count ?? 0) })),
      byPriority: TICKET_PRIORITIES.map(priority => ({ priority, count: Number(priorities.find(row => row.priority === priority)?.count ?? 0) })),
      dailyCreated: Array.from({ length: 7 }, (_, index) => {
        const date = new Date(firstDay);
        date.setUTCDate(date.getUTCDate() + index);
        const day = date.toISOString().slice(0, 10);
        return { date: day, count: Number(daily.find(row => row.date === day)?.count ?? 0) };
      }),
    };
  }

  async findAgent(id: string): Promise<UserSummary | null> {
    const user = await this.dataSource.getRepository(UserOrmEntity).findOne({
      where: { id, role: In([UserRole.AGENT, UserRole.ADMIN]) },
    });
    return user ? userSummary(user) : null;
  }
}
