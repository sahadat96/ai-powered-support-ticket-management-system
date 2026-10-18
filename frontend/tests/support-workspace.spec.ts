import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';

type Session = Awaited<ReturnType<BrowserContext['storageState']>>;

const runId = randomUUID();
const password = process.env.E2E_DEMO_PASSWORD ?? 'SupportDemo!2026';
const customerEmail = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@support.local';
const agentEmail = process.env.E2E_AGENT_EMAIL ?? 'agent@support.local';
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@support.local';
const queueTitle = `Browser queue ${runId} billing reference`;
const createdTicketIds = new Set<string>();
let customerSession: Session;
let agentSession: Session;
let adminApi: APIRequestContext | undefined;
let agentId: string;
let workflowTicketId: string;

async function signInWithBrowser(
  browser: Browser,
  baseURL: string,
  email: string,
): Promise<Session> {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back');
    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function createdTicket(api: APIRequestContext, title: string): Promise<string> {
  const response = await api.post('/api/v1/tickets', {
    data: {
      title,
      description:
        'The billing dashboard will not download our latest invoice. The browser shows a timeout after signing in.',
      category: 'BILLING',
      priority: 'HIGH',
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const ticket = (await response.json()) as { id: string };
  createdTicketIds.add(ticket.id);
  return ticket.id;
}

async function sendReply(page: Page, body: string, internal = false): Promise<void> {
  if (internal) await page.getByRole('button', { name: 'Internal note', exact: true }).click();
  await page.getByLabel(internal ? 'Internal note' : 'Reply message', { exact: true }).fill(body);
  await page
    .getByRole('button', { name: internal ? 'Add note' : 'Send reply', exact: true })
    .click();
  await expect(
    page.getByText(internal ? 'Internal note added.' : 'Reply sent.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
}

test.beforeAll(async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('A frontend base URL is required');
  // These tests require the explicitly seeded local demo accounts. Sessions stay in memory.
  // One administrator API login plus two browser logins stay below the real login throttle.
  const extraHTTPHeaders = { Origin: new URL(baseURL).origin };
  adminApi = await request.newContext({ baseURL, extraHTTPHeaders });
  const login = await adminApi.post('/api/v1/auth/login', {
    data: { email: adminEmail, password },
  });
  expect(
    login.status(),
    `Seed demo users and set E2E_DEMO_PASSWORD to their password before browser tests. API response: ${await login.text()}`,
  ).toBe(200);
  customerSession = await signInWithBrowser(browser, baseURL, customerEmail);
  agentSession = await signInWithBrowser(browser, baseURL, agentEmail);

  const customerApi = await request.newContext({
    baseURL,
    storageState: customerSession,
    extraHTTPHeaders,
  });
  const agentApi = await request.newContext({
    baseURL,
    storageState: agentSession,
    extraHTTPHeaders,
  });
  try {
    workflowTicketId = await createdTicket(
      customerApi,
      `Browser workflow ${runId} workspace access`,
    );
    await createdTicket(customerApi, queueTitle);
    const identity = await agentApi.get('/api/v1/auth/me');
    expect(identity.status()).toBe(200);
    const result = (await identity.json()) as { user: { id: string; role: string } };
    expect(result.user.role).toBe('AGENT');
    agentId = result.user.id;
  } finally {
    await customerApi.dispose();
    await agentApi.dispose();
  }
});

test.afterAll(async () => {
  if (!adminApi) return;
  try {
    // Only archive IDs returned by this test run. Existing demo conversations are never edited.
    for (const id of createdTicketIds) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const detail = await adminApi.get(`/api/v1/tickets/${id}`);
        if (detail.status() === 404) break;
        expect(detail.status()).toBe(200);
        const { ticket } = (await detail.json()) as { ticket: { version: number } };
        const removed = await adminApi.delete(`/api/v1/tickets/${id}?version=${ticket.version}`);
        if (removed.status() === 409 && attempt < 2) continue;
        expect(removed.status()).toBe(204);
        break;
      }
    }
  } finally {
    await adminApi.dispose();
  }
});

test('protects private routes and provides accessible sign-in validation and password visibility', async ({
  page,
}) => {
  await page.goto('/tickets');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Use at least 10 characters for your password.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(
    page.getByText('Enter your name using 1–100 characters.', { exact: true }),
  ).toBeVisible();
});

test('lets a customer create a ticket, review AI triage, and persist a conversation reply', async ({
  page,
  context,
}) => {
  await context.addCookies(customerSession.cookies);
  await page.goto('/tickets/new');
  const title = `Browser created ${runId} invoice download problem`;
  await page.getByLabel('Subject', { exact: false }).fill(title);
  await page
    .getByLabel('Description', { exact: false })
    .fill(
      'Our latest subscription invoice cannot be downloaded. The billing dashboard reports a server error after we click Download.',
    );
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/tickets' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const ticket = (await response.json()) as { id: string };
  createdTicketIds.add(ticket.id);
  await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}(?:\\?created=1)?$`));
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'A little clarity, from AI', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Suggested triage', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Internal note', exact: true })).toHaveCount(0);
  const reply = `Customer follow-up ${runId}: I also tried another browser and see the same error.`;
  await sendReply(page, reply);
  await page.reload();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(page.getByText('Comment Added', { exact: true })).toBeVisible();
});

test('lets staff assign, resolve, and annotate a ticket while keeping internal notes private', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await context.addCookies(agentSession.cookies);
  await page.goto(`/tickets/${workflowTicketId}`);
  const status = page.getByLabel('Status', { exact: true });
  await expect(status).toHaveValue('OPEN');
  await expect(status.locator('option[value="IN_PROGRESS"]')).toBeDisabled();
  const assignee = page.getByLabel('Assigned to', { exact: true });
  await expect(assignee).toBeEnabled();
  await assignee.selectOption(agentId);
  await expect(assignee).toHaveValue(agentId);
  await expect(status).toBeEnabled();
  await status.selectOption('IN_PROGRESS');
  await expect(status).toHaveValue('IN_PROGRESS');

  const privateNote = `Private staff context ${runId}: escalation details for the billing team.`;
  await sendReply(page, privateNote, true);
  await page.getByRole('button', { name: 'Use suggested reply', exact: false }).click();
  const publicDraft = page.getByLabel('Reply message', { exact: true });
  await expect(publicDraft).not.toHaveValue('');
  await expect(
    page.getByText('Suggested reply added to your draft. Review and edit it before sending.', {
      exact: true,
    }),
  ).toBeVisible();
  const publicReply = `Staff update ${runId}: we have restored invoice access and verified your billing workspace.`;
  await publicDraft.fill(publicReply);
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await expect(page.getByText(publicReply, { exact: true })).toBeVisible();
  await expect(status).toBeEnabled();
  await status.selectOption('RESOLVED');
  await expect(status).toHaveValue('RESOLVED');

  const requesterContext = await browser.newContext({ baseURL, storageState: customerSession });
  try {
    const requester = await requesterContext.newPage();
    await requester.goto(`/tickets/${workflowTicketId}`);
    await expect(requester.getByText(publicReply, { exact: true })).toBeVisible();
    await expect(requester.getByText(privateNote, { exact: true })).toHaveCount(0);
    await requester.getByRole('tab', { name: 'Activity', exact: true }).click();
    await expect(requester.getByText('Internal Note Added', { exact: true })).toHaveCount(0);
    const requesterStatus = requester.getByLabel('Status', { exact: true });
    await requesterStatus.selectOption('CLOSED');
    await expect(requesterStatus).toHaveValue('CLOSED');
    await requester.getByRole('tab', { name: /Conversation/ }).click();
    await expect(requester.getByText('This ticket is closed', { exact: true })).toBeVisible();
    await expect(requester.getByLabel('Reply message', { exact: true })).toHaveCount(0);
    await requesterStatus.selectOption('OPEN');
    await expect(requesterStatus).toHaveValue('OPEN');
    await expect(requester.getByLabel('Reply message', { exact: true })).toBeVisible();
  } finally {
    await requesterContext.close();
  }
});

test('recovers from a temporary loading error and supports queue search and filters', async ({
  page,
  context,
}) => {
  await context.addCookies(customerSession.cookies);
  let failRequests = true;
  await page.route(
    (url) => url.pathname === '/api/v1/tickets',
    async (route) => {
      if (route.request().method() === 'GET' && failRequests) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Temporary test outage. Please try again.' }),
        });
      } else await route.continue();
    },
  );
  await page.goto('/tickets');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Temporary test outage. Please try again.' }),
  ).toBeVisible();
  failRequests = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Search tickets', { exact: true }).fill(queueTitle);
  await expect(page.getByRole('link', { name: queueTitle, exact: true })).toBeVisible();
  await page.getByLabel('Sort tickets', { exact: true }).selectOption('priority');
  await page.getByLabel('Filter by category', { exact: true }).selectOption('BILLING');
  await expect(page.getByRole('link', { name: queueTitle, exact: true })).toBeVisible();
  await page.getByLabel('Search tickets', { exact: true }).fill(`Missing conversation ${runId}`);
  await expect(
    page.getByRole('heading', { name: 'No matching tickets', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
  await expect(page.getByRole('table')).toBeVisible();
});

test('validates a new ticket before submitting incomplete information', async ({
  page,
  context,
}) => {
  await context.addCookies(customerSession.cookies);
  await page.goto('/tickets/new');
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(
    page.getByText('Add a clear title with at least 5 characters.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Describe the issue in at least 15 characters so we can help.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Subject', { exact: false })).toBeFocused();
});

test('renders the desktop dashboard without page overflow', async ({ page, context }, testInfo) => {
  await context.addCookies(agentSession.cookies);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back');
  await expect(page.getByRole('link', { name: /Total tickets/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ticket activity', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1);
  const screenshot = testInfo.outputPath('dashboard-desktop.png');
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Dashboard desktop', { path: screenshot, contentType: 'image/png' });
});

test('supports a 390px mobile dashboard and opening navigation to customer tickets', async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies(customerSession.cookies);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back');
  await expect(page.getByRole('link', { name: /Total tickets/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1);
  const screenshot = testInfo.outputPath('dashboard-mobile.png');
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Dashboard mobile', { path: screenshot, contentType: 'image/png' });
  const openMenu = page.getByRole('button', { name: 'Open navigation', exact: true });
  await openMenu.click();
  await expect(
    page.getByRole('button', { name: 'Close navigation', exact: true }).last(),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'My tickets', exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(openMenu).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tickets', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1);
});
