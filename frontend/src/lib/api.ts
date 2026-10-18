export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {super(message); this.name = 'ApiError';}
}
export async function api<T>(path: string, options: {method?: string; body?: unknown; signal?: AbortSignal} = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {method: options.method ?? 'GET', credentials: 'same-origin', cache: 'no-store', signal: options.signal, headers: options.body === undefined ? undefined : {'Content-Type': 'application/json'}, body: options.body === undefined ? undefined : JSON.stringify(options.body)});
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Could not connect. Check your connection and try again.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {message?: string|string[]};
    const message = Array.isArray(payload.message) ? payload.message.join('. ') : payload.message ?? 'Something went wrong. Please try again.';
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
