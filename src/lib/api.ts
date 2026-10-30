export type ApiResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status: number }

export async function api<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const res = await fetch(path, {
      credentials: 'include',
      ...init,
      headers: isForm
        ? { ...(init?.headers || {}) }
        : {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
          },
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        error: data.error || res.statusText || 'Request failed.',
        status: res.status,
      }
    }
    return { ok: true, ...(data as T) }
  } catch {
    return { ok: false, error: 'Cannot reach the forum API.', status: 0 }
  }
}
