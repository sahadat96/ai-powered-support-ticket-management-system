import { expect, test, Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in to your workspace' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Hello,/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test.describe('Support workspace', () => {
  let token: string;
  const created: string[] = [];
  test.beforeAll(async ({ request }) => {
    const response = await request.post(
      'http://localhost:4000/api/v1/auth/login',
      {
        data: {
          email: 'admin@support.local',
          password: process.env.DEMO_PASSWORD,
        },
      },
    );
    expect(response.ok()).toBeTruthy();
    token = (await response.json()).accessToken;
  });
  test.afterAll(async ({ request }) => {
    for (const id of created) {
      const response = await request.get(
        `http://localhost:4000/api/v1/tickets/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.ok())
        await request.delete(`http://localhost:4000/api/v1/tickets/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { version: (await response.json()).version },
        });
    }
  });
  test('staff creates, triages, replies, resolves, and deletes a ticket', async ({
    page,
  }) => {
    const title = `Browser test API outage ${Date.now()}`;
    await login(page, 'admin@support.local');
    await page.getByRole('link', { name: 'New ticket' }).click();
    await page.getByLabel('Subject', { exact: true }).fill(title);
    await page
      .getByLabel('Description', { exact: true })
      .fill(
        'Production API is down for all users. The server is returning timeout errors and our integration is blocked.',
      );
    await page.getByRole('button', { name: 'Preview AI triage' }).click();
    await expect(page.getByText('A suggested starting point')).toBeVisible();
    await page
      .getByRole('button', { name: 'Create ticket', exact: true })
      .click();
    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);
    created.push(page.url().split('/').pop()!);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page
      .getByRole('button', { name: 'Analyze ticket', exact: true })
      .click();
    await expect(
      page.getByText('AI analysis is ready for your review.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Apply suggestions' }).click();
    await expect(page.getByLabel('Ticket priority')).toHaveValue('URGENT');
    await page.getByRole('button', { name: 'Use reply draft' }).click();
    await expect(page.getByLabel('Add your reply')).not.toHaveValue('');
    await page
      .getByLabel('Add your reply')
      .fill(
        'We have identified the incident and are investigating the API timeout.',
      );
    await page.getByRole('button', { name: 'Send reply' }).click();
    await expect(page.getByText('Your reply has been added.')).toBeVisible();
    await page.getByLabel('Ticket status').selectOption('IN_PROGRESS');
    await expect(page.getByLabel('Ticket status')).toHaveValue('IN_PROGRESS');
    await page.getByLabel('Ticket status').selectOption('RESOLVED');
    await expect(page.getByLabel('Ticket status')).toHaveValue('RESOLVED');
    await page
      .getByRole('button', { name: 'Delete ticket', exact: true })
      .click();
    await page.getByRole('button', { name: 'Yes, delete permanently' }).click();
    await expect(page).toHaveURL(/\/tickets$/);
    await page
      .getByRole('textbox', { name: 'Search tickets', exact: true })
      .fill(title);
    await expect(
      page.getByRole('heading', { name: 'No tickets here yet' }),
    ).toBeVisible();
  });
  test('customer sees own tickets and cannot see staff triage controls', async ({
    page,
    request,
  }) => {
    const response = await request.post(
      'http://localhost:4000/api/v1/tickets',
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          title: `Private admin request ${Date.now()}`,
          description:
            'This request belongs to the administrator and must not be visible to a different customer.',
        },
      },
    );
    const privateTicket = await response.json();
    created.push(privateTicket.id);
    await login(page, 'customer@support.local');
    await page.goto(`/tickets/${privateTicket.id}`);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Ticket not found.' }),
    ).toBeVisible();
    await page.goto('/tickets/10000000-0000-4000-8000-000000000001');
    await expect(
      page.getByRole('heading', {
        name: 'Production API is unavailable for all users',
      }),
    ).toBeVisible();
    await expect(page.getByLabel('Ticket priority')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Analyze ticket', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete ticket', exact: true }),
    ).toHaveCount(0);
  });
  test('shows usable loading and service error states without horizontal overflow', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Welcome back.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message:
            'The support service is unavailable. Please try again shortly.',
        }),
      }),
    );
    await page.getByLabel('Email address').fill('admin@support.local');
    await page
      .getByLabel('Password', { exact: true })
      .fill(process.env.DEMO_PASSWORD!);
    await page
      .getByRole('button', { name: 'Sign in to your workspace' })
      .click();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'support service is unavailable' }),
    ).toBeVisible();
  });
});
