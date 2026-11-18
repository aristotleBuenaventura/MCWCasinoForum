import { test, expect } from '@playwright/test'

/**
 * API-level admin account security checks against WordPress mcw/v1.
 * Does not demote, ban, delete, or change passwords of existing admins.
 */
const WP = process.env.MCW_WP_URL || 'http://127.0.0.1:8080'
const ORIGIN = process.env.MCW_CORS_ORIGIN || 'http://localhost:5173'
const api = (path: string) => `${WP}/wp-json/mcw/v1${path}`

async function jsonFetch(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers(init.headers || {})
  headers.set('Origin', ORIGIN)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (init.cookie) headers.set('Cookie', init.cookie)
  const res = await fetch(api(path), { ...init, headers })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

function cookieFrom(res: Response): string {
  // Node fetch may expose getSetCookie
  const anyRes = res as Response & { headers: Headers & { getSetCookie?: () => string[] } }
  const list = anyRes.headers.getSetCookie?.() || []
  if (list.length) return list.map((c) => c.split(';')[0]).join('; ')
  const single = res.headers.get('set-cookie')
  return single ? single.split(';')[0] : ''
}

test.describe('Administrator account authorization', () => {
  test('anonymous cannot access admin user APIs', async () => {
    const users = await jsonFetch('/admin/users')
    expect([401, 403]).toContain(users.status)

    const role = await jsonFetch('/admin/users/1/role', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin' }),
    })
    expect([401, 403]).toContain(role.status)
  })

  test('regular user cannot promote self or touch admin', async () => {
    const loginName = `sec_${Date.now().toString(36)}`
    const reg = await fetch(api('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({
        username: loginName,
        email: `${loginName}@example.test`,
        password: 'SecTestPass123!',
        displayName: 'Sec Tester',
        role: 'admin',
      }),
    })
    expect(reg.status).toBe(200)
    const cookie = cookieFrom(reg)
    expect(cookie).toContain('mcw_session')

    const me = await jsonFetch('/bootstrap', { cookie })
    expect(me.status).toBe(200)
    const boot = me.body as { me?: { id?: string; role?: string } }
    expect(boot.me?.role).toBe('user')
    const myId = boot.me?.id
    expect(myId).toBeTruthy()

    const selfPromote = await jsonFetch(`/admin/users/${myId}/role`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ role: 'admin' }),
    })
    expect([401, 403]).toContain(selfPromote.status)

    const adminList = await jsonFetch('/admin/users', { cookie })
    expect([401, 403]).toContain(adminList.status)

    const demoteAdmin = await jsonFetch('/admin/users/1/role', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ role: 'user' }),
    })
    expect([401, 403]).toContain(demoteAdmin.status)

    const banAdmin = await jsonFetch('/mod/users/1/ban', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ banned: true }),
    })
    expect([401, 403]).toContain(banAdmin.status)

    // Cleanup own throwaway account only (password required) — never touches admins.
    await jsonFetch('/auth/account', {
      method: 'DELETE',
      cookie,
      body: JSON.stringify({ password: 'SecTestPass123!' }),
    })
  })
})
