import { expect, test } from '@playwright/test';

test('preserves an absent Origin on a valid non-browser POST request', async ({ request }) => {
  // This request context has no browser cookies and deliberately sends no Origin.
  const response = await request.post('/api/v1/auth/logout');

  expect(response.status()).toBe(204);
  expect(response.headers()['set-cookie']).toContain('support_session=;');
});

test('rejects a proxy POST body larger than 128 KiB with Content-Length', async ({ request }) => {
  const response = await request.post('/api/v1/tickets', {
    data: { description: 'x'.repeat(160 * 1024) },
  });

  expect(response.status()).toBe(413);
  await expect(response.json()).resolves.toMatchObject({ message: 'Request is too large' });
});

test('bounds a chunked proxy request without relying on Content-Length', async ({ baseURL }) => {
  if (!baseURL) throw new Error('A frontend base URL is required');
  const encoded = new TextEncoder().encode(JSON.stringify({ description: 'x'.repeat(160 * 1024) }));
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= encoded.byteLength) {
        controller.close();
        return;
      }
      const next = encoded.subarray(offset, offset + 16 * 1024);
      offset += next.byteLength;
      controller.enqueue(next);
    },
  });
  // Node's streaming fetch sends Transfer-Encoding: chunked for this body.
  // Deliberately omit Content-Length so the proxy must count bytes as it reads.
  const options: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    duplex: 'half',
  };
  const response = await fetch(new URL('/api/v1/tickets', baseURL), options);

  expect(response.status).toBe(413);
  await expect(response.json()).resolves.toMatchObject({ message: 'Request is too large' });
});
