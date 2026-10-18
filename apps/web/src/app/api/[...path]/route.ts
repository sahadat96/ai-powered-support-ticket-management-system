import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const {path} = await context.params;
  if (!['auth', 'tickets', 'ai', 'health'].includes(path[0]) || path.some(p => !/^[a-zA-Z0-9-]+$/.test(p))) return NextResponse.json({message: 'Not found.'}, {status: 404});
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const origin = request.headers.get('origin');
  const expectedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  if (!safe && origin !== expectedOrigin) return NextResponse.json({message: 'Request origin is not allowed.'}, {status: 403});
  try {
    const headers = new Headers({'Content-Type': 'application/json'});
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
    if (origin) headers.set('origin', origin);
    const body = safe ? undefined : await request.text();
    if (body && body.length > 20000) return NextResponse.json({message: 'Request body is too large.'}, {status: 413});
    const base = process.env.API_URL ?? 'http://localhost:4000/api/v1';
    const upstream = await fetch(`${base}/${path.join('/')}${request.nextUrl.search}`, {method: request.method, headers, body: body || undefined, cache: 'no-store', signal: AbortSignal.timeout(15000)});
    const outputHeaders = new Headers({'Cache-Control': 'no-store'});
    for (const value of upstream.headers.getSetCookie()) outputHeaders.append('set-cookie', value);
    if (upstream.status === 204) return new NextResponse(null, {status: 204, headers: outputHeaders});
    const data = await upstream.json();
    // Browser sessions use HttpOnly cookies; keep bearer credentials out of JS.
    if (path[0] === 'auth' && data.accessToken) delete data.accessToken;
    return NextResponse.json(data, {status: upstream.status, headers: outputHeaders});
  } catch {
    return NextResponse.json({message: 'The support service is unavailable. Please try again shortly.'}, {status: 503});
  }
}
export {proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE};
