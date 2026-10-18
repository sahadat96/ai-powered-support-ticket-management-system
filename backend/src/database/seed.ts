import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import type { Prisma } from '../generated/prisma/client';
import { createPrismaClient } from './prisma-client';
import { TriageService } from '../modules/ai/application/triage.service';
import { TicketCategory, TicketPriority, TicketStatus } from '../modules/tickets/domain/ticket';
import { UserRole } from '../modules/users/domain/user';

config({ path: ['.env', '../.env'], quiet: true });

interface DemoTicket {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned: boolean;
}

const DEMO_TICKETS: readonly DemoTicket[] = [
  {
    title: 'Charged twice for our monthly subscription',
    description:
      'Our October subscription payment appears twice on the statement. Both charges have the same invoice reference INV-2048. Please investigate and refund the duplicate payment.',
    category: 'BILLING',
    priority: 'HIGH',
    status: 'OPEN',
    assigned: false,
  },
  {
    title: 'Production dashboard unavailable for all users',
    description:
      'The production dashboard returns a 503 error for all users in our team. We cannot access customer reports, and the entire service appears to be down.',
    category: 'TECHNICAL',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assigned: true,
  },
  {
    title: 'Help resetting two-factor authentication',
    description:
      'I replaced my phone and can no longer log in using the authenticator. Please explain the account recovery process. I still have access to my verified email address.',
    category: 'ACCOUNT',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assigned: true,
  },
  {
    title: 'Export report downloads an empty CSV file',
    description:
      'The reporting page displays 84 records, but exporting the selected date range downloads an empty CSV file. This happens in Chrome and Firefox with no filters applied.',
    category: 'TECHNICAL',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    assigned: true,
  },
  {
    title: 'Request a copy of our September invoice',
    description:
      'Our finance team needs the September subscription invoice showing the company billing address and tax information. Could you send the invoice download instructions?',
    category: 'BILLING',
    priority: 'MEDIUM',
    status: 'CLOSED',
    assigned: true,
  },
  {
    title: 'Feature request for a compact dashboard layout',
    description:
      'A compact dashboard view would help our support team see more tickets on smaller screens. This is a nice to have suggestion and is not urgent.',
    category: 'GENERAL',
    priority: 'LOW',
    status: 'OPEN',
    assigned: false,
  },
  {
    title: 'Update company name on account profile',
    description:
      'Our organization has changed its registered company name. Please explain how an account administrator can update the organization profile without losing existing team members.',
    category: 'ACCOUNT',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    assigned: true,
  },
  {
    title: 'Question about inviting colleagues to a workspace',
    description:
      'We are onboarding three colleagues next week. Where can I find a guide to invite new members and choose the appropriate workspace permissions? There is no rush.',
    category: 'GENERAL',
    priority: 'LOW',
    status: 'CLOSED',
    assigned: true,
  },
  {
    title: 'Image attachment upload fails in ticket form',
    description:
      'Uploading a 2 MB PNG screenshot in the support form fails with a network error after the progress bar completes. Text-only submissions continue to work normally.',
    category: 'TECHNICAL',
    priority: 'MEDIUM',
    status: 'OPEN',
    assigned: true,
  },
  {
    title: 'Need to change subscription billing frequency',
    description:
      'We would like to move from monthly billing to an annual subscription at the next renewal. Please explain the available plan options and when the change would take effect.',
    category: 'BILLING',
    priority: 'MEDIUM',
    status: 'OPEN',
    assigned: false,
  },
];

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production.');
  if (process.env.SEED_DEMO !== 'true')
    throw new Error('Set SEED_DEMO=true explicitly to create local demo records.');
  const password = process.env.DEMO_PASSWORD ?? '';
  if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      'DEMO_PASSWORD must contain at least 10 characters and at most 72 UTF-8 bytes.',
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed demo records.');
  const data = createPrismaClient(connectionString);
  try {
    const triage = new TriageService();
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await data.$transaction(
      async (transaction) => {
        // Concurrent invocations cannot duplicate demo fixtures. This lock ends with the transaction.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('support-demo-seed-v1'))`;
        const users: { id: string; role: string }[] = [];
        let createdUsers = 0;
        for (const account of [
          { email: 'admin@support.local', name: 'Alex Morgan', role: UserRole.ADMIN },
          { email: 'agent@support.local', name: 'Jordan Lee', role: UserRole.AGENT },
          { email: 'customer@support.local', name: 'Sam Taylor', role: UserRole.CUSTOMER },
        ]) {
          let user = await transaction.user.findUnique({ where: { email: account.email } });
          if (user && user.role !== account.role) {
            throw new Error(
              `An existing demo email has an unexpected role: ${account.email}. Existing accounts were left unchanged.`,
            );
          }
          if (!user) {
            user = await transaction.user.create({ data: { ...account, passwordHash } });
            createdUsers += 1;
          }
          users.push(user);
        }
        const [, agent, customer] = users;
        let createdTickets = 0;
        const now = Date.now();
        for (const [index, fixture] of DEMO_TICKETS.entries()) {
          const id = `f0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
          // Do not reset edited, archived, reassigned, or otherwise existing demo tickets.
          if (await transaction.ticket.findUnique({ where: { id }, select: { id: true } }))
            continue;
          const createdAt = new Date(
            now - ((DEMO_TICKETS.length - 1 - index) * 16 + 2) * 60 * 60 * 1000,
          );
          const updatedAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
          const ticket = await transaction.ticket.create({
            data: {
              id,
              title: fixture.title,
              description: fixture.description,
              category: fixture.category,
              priority: fixture.priority,
              status: fixture.status,
              requesterId: customer.id,
              assigneeId: fixture.assigned ? agent.id : null,
              ai: triage.analyze(
                fixture.title,
                fixture.description,
              ) as unknown as Prisma.InputJsonValue,
              version: 1,
              createdAt,
              updatedAt,
              deletedAt: null,
              resolvedAt: ['RESOLVED', 'CLOSED'].includes(fixture.status) ? updatedAt : null,
            },
          });
          await transaction.ticketEvent.create({
            data: {
              ticketId: ticket.id,
              actorId: customer.id,
              action: 'CREATED',
              detail: 'Ticket created and automatically triaged',
              createdAt,
            },
          });
          if (fixture.assigned) {
            await transaction.ticketEvent.create({
              data: {
                ticketId: ticket.id,
                actorId: agent.id,
                action: 'ASSIGNED',
                detail: 'Assigned to Jordan Lee',
                createdAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
              },
            });
          }
          if (fixture.status !== 'OPEN') {
            await transaction.ticketEvent.create({
              data: {
                ticketId: ticket.id,
                actorId: agent.id,
                action: 'STATUS_CHANGED',
                detail: `Status changed from OPEN to ${fixture.status}`,
                createdAt: updatedAt,
              },
            });
          }
          if (index === 0) {
            await transaction.comment.createMany({
              data: [
                {
                  ticketId: ticket.id,
                  authorId: agent.id,
                  internal: false,
                  body: 'Thanks for the invoice reference. We are checking the duplicate charge with our billing team and will update you here.',
                  createdAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
                },
                {
                  ticketId: ticket.id,
                  authorId: agent.id,
                  internal: true,
                  body: 'Billing review: compare both payment references before authorizing a refund. This note is visible only to the support team.',
                  createdAt: new Date(createdAt.getTime() + 20 * 60 * 1000),
                },
              ],
            });
            await transaction.ticketEvent.createMany({
              data: [
                {
                  ticketId: ticket.id,
                  actorId: agent.id,
                  action: 'COMMENT_ADDED',
                  detail: 'A reply was added to the conversation',
                  createdAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
                },
                {
                  ticketId: ticket.id,
                  actorId: agent.id,
                  action: 'INTERNAL_NOTE_ADDED',
                  detail: 'A team member added an internal note',
                  createdAt: new Date(createdAt.getTime() + 20 * 60 * 1000),
                },
              ],
            });
          }
          createdTickets += 1;
        }
        return { createdUsers, createdTickets };
      },
      { timeout: 30_000 },
    );
    console.log(
      `Demo seed complete: ${result.createdUsers} users and ${result.createdTickets} tickets created. Existing records and passwords were preserved.`,
    );
    console.log(
      'Demo accounts: admin@support.local, agent@support.local, customer@support.local. Use the configured DEMO_PASSWORD for newly created accounts.',
    );
  } finally {
    await data.$disconnect();
  }
}

seed().catch((error: unknown) => {
  // Driver errors can contain SQL parameters. Keep credentials and user records out of terminal output.
  const message =
    error instanceof Error && !error.name.startsWith('Prisma') && !('query' in error)
      ? error.message
      : 'Database operation failed; check database availability and migrations.';
  console.error(`Demo seed failed: ${message}`);
  process.exitCode = 1;
});
