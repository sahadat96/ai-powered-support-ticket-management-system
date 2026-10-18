import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import { UserRole } from '../../users/domain/user';
import {
  DashboardStats,
  Ticket,
  TicketComment,
  TicketEvent,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  UserSummary,
} from '../domain/ticket';
import {
  CreateTicketRecord,
  TicketListQuery,
  TicketPage,
  TicketPatch,
  TicketRepository,
} from '../domain/ticket.repository';

// Select only public user fields when hydrating a ticket, comment, or event.
const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const ticketSelect = {
  id: true,
  number: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  requesterId: true,
  assigneeId: true,
  requester: { select: userSummarySelect },
  assignee: { select: userSummarySelect },
  ai: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
} satisfies Prisma.TicketSelect;

const commentSelect = {
  id: true,
  ticketId: true,
  body: true,
  internal: true,
  authorId: true,
  author: { select: userSummarySelect },
  createdAt: true,
} satisfies Prisma.CommentSelect;

const eventSelect = {
  id: true,
  ticketId: true,
  actorId: true,
  actor: { select: userSummarySelect },
  action: true,
  detail: true,
  createdAt: true,
} satisfies Prisma.TicketEventSelect;

type TicketRecord = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>;
type CountRow = { count: bigint };
type CountsRow = {
  total: bigint;
  open: bigint;
  inProgress: bigint;
  resolved: bigint;
  closed: bigint;
  unassigned: bigint;
};

function toTicket(record: TicketRecord): Ticket {
  return {
    id: record.id,
    number: record.number,
    title: record.title,
    description: record.description,
    // The existing database CHECK constraints enforce these domain values.
    status: record.status as Ticket['status'],
    priority: record.priority as Ticket['priority'],
    category: record.category as Ticket['category'],
    requesterId: record.requesterId,
    assigneeId: record.assigneeId,
    requester: record.requester,
    assignee: record.assignee,
    ai: record.ai as unknown as Ticket['ai'],
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.resolvedAt,
  };
}

@Injectable()
export class PrismaTicketRepository extends TicketRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async read(client: Prisma.TransactionClient, id: string): Promise<Ticket | null> {
    const record = await client.ticket.findFirst({
      where: { id, deletedAt: null },
      select: ticketSelect,
    });
    return record ? toTicket(record) : null;
  }

  async create(input: CreateTicketRecord, actorId: string): Promise<Ticket> {
    return this.prisma.$transaction(async (client) => {
      const record = await client.ticket.create({
        data: {
          ...input,
          ai: input.ai as unknown as Prisma.InputJsonValue,
          status: 'OPEN',
          assigneeId: null,
          resolvedAt: null,
          deletedAt: null,
          version: 1,
        },
        select: ticketSelect,
      });
      await client.ticketEvent.create({
        data: {
          ticketId: record.id,
          actorId,
          action: 'CREATED',
          detail: 'Ticket created and automatically triaged',
        },
      });
      return toTicket(record);
    });
  }

  findById(id: string): Promise<Ticket | null> {
    return this.read(this.prisma, id);
  }

  async list(query: TicketListQuery): Promise<TicketPage> {
    const conditions = [Prisma.sql`ticket.deleted_at IS NULL`];
    if (query.requesterId)
      conditions.push(Prisma.sql`ticket.requester_id = ${query.requesterId}::uuid`);
    if (query.status) conditions.push(Prisma.sql`ticket.status = ${query.status}`);
    if (query.priority) conditions.push(Prisma.sql`ticket.priority = ${query.priority}`);
    if (query.category) conditions.push(Prisma.sql`ticket.category = ${query.category}`);
    if (query.assigneeId)
      conditions.push(Prisma.sql`ticket.assignee_id = ${query.assigneeId}::uuid`);
    if (query.unassigned) conditions.push(Prisma.sql`ticket.assignee_id IS NULL`);
    if (query.search?.trim()) {
      // PostgreSQL LIKE patterns use backslash as the default escape character.
      // Escaping these characters makes the user's search literal, with every value bound.
      const search = `%${query.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(Prisma.sql`(
        ticket.title ILIKE ${search}
        OR ticket.description ILIKE ${search}
        OR ticket.number::text ILIKE ${search}
      )`);
    }
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    const order =
      query.sort === 'priority'
        ? Prisma.sql`CASE ticket.priority
            WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3
          END ASC, ticket.created_at DESC, ticket.id ASC`
        : query.sort === 'oldest'
          ? Prisma.sql`ticket.created_at ASC, ticket.id ASC`
          : Prisma.sql`ticket.created_at DESC, ticket.id ASC`;

    return this.prisma.$transaction(async (client) => {
      // Native Prisma orderBy cannot express the domain's priority ordering.
      // Read the page IDs with safe SQL, then hydrate using explicit Prisma selects.
      const [ids, counts] = await Promise.all([
        client.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT ticket.id FROM support.tickets AS ticket ${where}
          ORDER BY ${order}
          LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
        `),
        client.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*) AS count FROM support.tickets AS ticket ${where}
        `),
      ]);
      const records = await client.ticket.findMany({
        where: { id: { in: ids.map((row) => row.id) }, deletedAt: null },
        select: ticketSelect,
      });
      const recordsById = new Map(records.map((record) => [record.id, record]));
      const total = Number(counts[0]?.count ?? 0);
      return {
        items: ids.flatMap(({ id }) => {
          const record = recordsById.get(id);
          return record ? [toTicket(record)] : [];
        }),
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      };
    });
  }

  async update(
    id: string,
    version: number,
    patch: TicketPatch,
    actorId: string,
    action: string,
    detail: string,
  ): Promise<Ticket | null> {
    return this.prisma.$transaction(async (client) => {
      const result = await client.ticket.updateMany({
        where: { id, version, deletedAt: null },
        data: {
          ...patch,
          ai: patch.ai === undefined ? undefined : (patch.ai as unknown as Prisma.InputJsonValue),
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      if (!result.count) return null;
      await client.ticketEvent.create({ data: { ticketId: id, actorId, action, detail } });
      return this.read(client, id);
    });
  }

  async delete(id: string, version: number, actorId: string): Promise<boolean> {
    return this.prisma.$transaction(async (client) => {
      const now = new Date();
      const result = await client.ticket.updateMany({
        where: { id, version, deletedAt: null },
        data: { deletedAt: now, updatedAt: now, version: { increment: 1 } },
      });
      if (!result.count) return false;
      await client.ticketEvent.create({
        data: {
          ticketId: id,
          actorId,
          action: 'DELETED',
          detail: 'Ticket archived; conversation and audit history retained',
        },
      });
      return true;
    });
  }

  async comments(ticketId: string, includeInternal: boolean): Promise<TicketComment[]> {
    return this.prisma.comment.findMany({
      where: { ticketId, ...(includeInternal ? {} : { internal: false }) },
      select: commentSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async addComment(
    ticketId: string,
    authorId: string,
    body: string,
    internal: boolean,
  ): Promise<TicketComment> {
    return this.prisma.$transaction(async (client) => {
      // Lock the ticket against status changes and archival before accepting a reply.
      const [ticket] = await client.$queryRaw<{ status: string }[]>(Prisma.sql`
        SELECT status FROM support.tickets
        WHERE id = ${ticketId}::uuid AND deleted_at IS NULL
        FOR UPDATE
      `);
      if (!ticket || ticket.status === 'CLOSED') {
        throw new ConflictException(
          'This ticket has been closed or removed. Refresh before replying.',
        );
      }
      const comment = await client.comment.create({
        data: { ticketId, authorId, body, internal },
        select: commentSelect,
      });
      await client.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
      await client.ticketEvent.create({
        data: {
          ticketId,
          actorId: authorId,
          action: internal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
          detail: internal
            ? 'A team member added an internal note'
            : 'A reply was added to the conversation',
        },
      });
      return comment;
    });
  }

  async events(ticketId: string): Promise<TicketEvent[]> {
    return this.prisma.ticketEvent.findMany({
      where: { ticketId },
      select: eventSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async stats(requesterId?: string): Promise<DashboardStats> {
    const scope = requesterId
      ? Prisma.sql`ticket.deleted_at IS NULL AND ticket.requester_id = ${requesterId}::uuid`
      : Prisma.sql`ticket.deleted_at IS NULL`;
    const firstDay = new Date();
    firstDay.setUTCHours(0, 0, 0, 0);
    firstDay.setUTCDate(firstDay.getUTCDate() - 6);
    const [counts, categories, priorities, daily] = await Promise.all([
      this.prisma.$queryRaw<CountsRow[]>(Prisma.sql`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE ticket.status = 'OPEN') AS open,
          COUNT(*) FILTER (WHERE ticket.status = 'IN_PROGRESS') AS "inProgress",
          COUNT(*) FILTER (WHERE ticket.status = 'RESOLVED') AS resolved,
          COUNT(*) FILTER (WHERE ticket.status = 'CLOSED') AS closed,
          COUNT(*) FILTER (WHERE ticket.assignee_id IS NULL) AS unassigned
        FROM support.tickets AS ticket WHERE ${scope}
      `),
      this.prisma.$queryRaw<(CountRow & { category: string })[]>(Prisma.sql`
        SELECT ticket.category, COUNT(*) AS count
        FROM support.tickets AS ticket WHERE ${scope} GROUP BY ticket.category
      `),
      this.prisma.$queryRaw<(CountRow & { priority: string })[]>(Prisma.sql`
        SELECT ticket.priority, COUNT(*) AS count
        FROM support.tickets AS ticket WHERE ${scope} GROUP BY ticket.priority
      `),
      this.prisma.$queryRaw<(CountRow & { date: string })[]>(Prisma.sql`
        SELECT to_char(ticket.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          COUNT(*) AS count
        FROM support.tickets AS ticket
        WHERE ${scope} AND ticket.created_at >= ${firstDay}
        GROUP BY to_char(ticket.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      `),
    ]);
    return {
      total: Number(counts[0]?.total ?? 0),
      open: Number(counts[0]?.open ?? 0),
      inProgress: Number(counts[0]?.inProgress ?? 0),
      resolved: Number(counts[0]?.resolved ?? 0),
      closed: Number(counts[0]?.closed ?? 0),
      unassigned: Number(counts[0]?.unassigned ?? 0),
      byCategory: TICKET_CATEGORIES.map((category) => ({
        category,
        count: Number(categories.find((row) => row.category === category)?.count ?? 0),
      })),
      byPriority: TICKET_PRIORITIES.map((priority) => ({
        priority,
        count: Number(priorities.find((row) => row.priority === priority)?.count ?? 0),
      })),
      dailyCreated: Array.from({ length: 7 }, (_, index) => {
        const date = new Date(firstDay);
        date.setUTCDate(date.getUTCDate() + index);
        const day = date.toISOString().slice(0, 10);
        return { date: day, count: Number(daily.find((row) => row.date === day)?.count ?? 0) };
      }),
    };
  }

  async findAgent(id: string): Promise<UserSummary | null> {
    return this.prisma.user.findFirst({
      where: { id, role: { in: [UserRole.AGENT, UserRole.ADMIN] } },
      select: userSummarySelect,
    });
  }
}
