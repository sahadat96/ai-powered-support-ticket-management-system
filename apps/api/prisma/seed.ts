import { PrismaClient, TicketStatus, Priority, Category } from '@prisma/client';
import { hash } from 'bcryptjs';
import { LocalTicketAnalyzer } from '../src/modules/ai/infrastructure/local-ticket-analyzer';

const prisma = new PrismaClient();
async function seed() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10)
    throw new Error(
      'Set DEMO_PASSWORD to at least 10 characters before seeding.',
    );
  const passwordHash = await hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@support.local' },
    update: {},
    create: {
      email: 'admin@support.local',
      name: 'Sahadat Hossain',
      role: 'ADMIN',
      passwordHash,
    },
  });
  const agent = await prisma.user.upsert({
    where: { email: 'agent@support.local' },
    update: {},
    create: {
      email: 'agent@support.local',
      name: 'Alex Morgan',
      role: 'AGENT',
      passwordHash,
    },
  });
  const customer = await prisma.user.upsert({
    where: { email: 'customer@support.local' },
    update: {},
    create: {
      email: 'customer@support.local',
      name: 'Jamie Chen',
      role: 'CUSTOMER',
      passwordHash,
    },
  });
  const examples: {
    title: string;
    description: string;
    status: TicketStatus;
    category: Category;
    priority: Priority;
  }[] = [
    {
      title: 'Production API is unavailable for all users',
      description:
        'Our production API is returning timeout errors for all users. The outage started this morning and our team cannot continue working.',
      status: 'OPEN',
      category: 'TECHNICAL',
      priority: 'URGENT',
    },
    {
      title: 'Charged twice for the monthly subscription',
      description:
        'The same monthly subscription payment appears twice on our invoice. Please review the duplicate charge and advise about a refund.',
      status: 'IN_PROGRESS',
      category: 'BILLING',
      priority: 'HIGH',
    },
    {
      title: 'Unable to reset my account password',
      description:
        'The password reset link expires immediately after I receive it. I have tried requesting a new link but I am still locked out of my account.',
      status: 'OPEN',
      category: 'ACCOUNT',
      priority: 'HIGH',
    },
    {
      title: 'Add dark mode to the dashboard',
      description:
        'Feature request: our team would appreciate a dark mode option in the dashboard for late-night work. Thank you for considering this suggestion.',
      status: 'OPEN',
      category: 'GENERAL',
      priority: 'LOW',
    },
    {
      title: 'Invoice needs our updated company address',
      description:
        'Our latest invoice still displays our old billing address. Could you help us update the company details before the next payment?',
      status: 'WAITING_ON_CUSTOMER',
      category: 'BILLING',
      priority: 'MEDIUM',
    },
    {
      title: 'CSV export fails on large reports',
      description:
        'The export button returns a server error when the report has more than a thousand rows. Smaller reports download successfully.',
      status: 'IN_PROGRESS',
      category: 'TECHNICAL',
      priority: 'MEDIUM',
    },
    {
      title: 'Need help inviting a new team member',
      description:
        'The user invitation email has not arrived for our new team member. We checked their spam folder and confirmed the email address.',
      status: 'RESOLVED',
      category: 'ACCOUNT',
      priority: 'MEDIUM',
    },
    {
      title: 'Where can I find the API documentation?',
      description:
        'We are evaluating the product and would like a guide to the available API integrations. Is there an onboarding tutorial for developers?',
      status: 'CLOSED',
      category: 'GENERAL',
      priority: 'LOW',
    },
    {
      title: 'Webhook events are arriving late',
      description:
        'Our integration webhook events take several minutes to arrive after an update. Please help us investigate the API sync performance.',
      status: 'OPEN',
      category: 'TECHNICAL',
      priority: 'MEDIUM',
    },
    {
      title: 'Question about annual subscription pricing',
      description:
        'We would like to switch our subscription from monthly to annual billing. Can you explain the pricing and whether a discount applies?',
      status: 'OPEN',
      category: 'BILLING',
      priority: 'LOW',
    },
  ];
  const analyzer = new LocalTicketAnalyzer();
  for (const [i, row] of examples.entries()) {
    const id = `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const analysis = await analyzer.analyze(row.title, row.description);
    await prisma.ticket.upsert({
      where: { id },
      update: {},
      create: {
        ...row,
        id,
        requesterId: customer.id,
        assigneeId: i % 3 === 0 ? null : agent.id,
        createdAt: new Date(Date.now() - (i + 1) * 3600000),
        resolvedAt: ['RESOLVED', 'CLOSED'].includes(row.status)
          ? new Date()
          : null,
        aiAnalysis: { ...analysis },
        activities: {
          create: [
            {
              actorId: customer.id,
              action: 'CREATED',
              detail: 'Ticket submitted',
            },
            {
              actorId: admin.id,
              action: 'ANALYZED',
              detail: 'Seed example with local AI triage',
            },
          ],
        },
        ...(i === 1
          ? {
              comments: {
                create: {
                  authorId: agent.id,
                  body: 'I’m reviewing the transaction references. I’ll follow up once the duplicate charge has been confirmed.',
                },
              },
            }
          : {}),
      },
    });
  }
  console.log(
    'Demo data ready: admin@support.local, agent@support.local, customer@support.local. Password: the DEMO_PASSWORD in your root .env. Existing users and tickets were preserved.',
  );
}
seed()
  .catch(() => {
    console.error(
      'Seed failed. Check database connectivity and DEMO_PASSWORD.',
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
