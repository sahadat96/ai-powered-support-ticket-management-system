export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, {...options, headers: {'Content-Type': 'application/json', ...options.headers}, credentials: 'same-origin', cache: 'no-store'}); }
  catch { throw new ApiError('Unable to connect. Check your connection and try again.', 0); }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({message: 'An unexpected response was received.'}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(Array.isArray(body.message) ? body.message.join(' ') : body.message ?? 'Something went wrong.', response.status);
  }
  return body;
}
export const json = (method: string, body: unknown): RequestInit => ({method, body: JSON.stringify(body)});
