import { NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
const MAX_BODY_BYTES = 128 * 1024;
class RequestTooLarge extends Error {}
async function readBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (['GET', 'HEAD'].includes(request.method) || !request.body) return undefined;
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    await request.body.cancel();
    throw new RequestTooLarge();
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new ArrayBuffer(total);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const base = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const url = new URL(`${base}/api/v1/${path.map(encodeURIComponent).join('/')}`);
  url.search = request.nextUrl.search;
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  // Preserve the browser's Origin; CLI clients may legitimately omit it.
  for (const header of ['cookie', 'authorization', 'origin']) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }
  try {
    const body = await readBody(request);
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    const outgoing = new Headers({
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    });
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append('Set-Cookie', cookie);
    return new Response(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: outgoing,
    });
  } catch (error) {
    if (error instanceof RequestTooLarge)
      return Response.json({ message: 'Request is too large' }, { status: 413 });
    return Response.json(
      { message: 'The support API is unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
