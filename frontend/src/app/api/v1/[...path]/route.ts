import {NextRequest} from 'next/server';
export const dynamic = 'force-dynamic';
async function proxy(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const {path} = await context.params;
  const base = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const url = new URL(`${base}/api/v1/${path.map(encodeURIComponent).join('/')}`);
  url.search = request.nextUrl.search;
  const headers = new Headers({'Content-Type': 'application/json', 'Origin': request.headers.get('origin') ?? request.nextUrl.origin});
  for (const header of ['cookie', 'authorization']) {const value = request.headers.get(header); if (value) headers.set(header, value);}
  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 128 * 1024) return Response.json({message: 'Request is too large'}, {status: 413});
    const upstream = await fetch(url, {method: request.method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000)});
    const outgoing = new Headers({'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store'});
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append('Set-Cookie', cookie);
    return new Response(upstream.status === 204 ? null : await upstream.arrayBuffer(), {status: upstream.status, headers: outgoing});
  } catch {return Response.json({message: 'The support API is unavailable. Please try again shortly.'}, {status: 503});}
}
export {proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE};
