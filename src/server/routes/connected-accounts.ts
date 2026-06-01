import { Hono } from 'hono'
import type { Context } from 'hono'
import { config } from '@/server/config'
import {
  listConnectedAccounts,
  listConnectedProviders,
  deleteConnectedAccount,
  setAccountSendMode,
  setAccountAllowList,
} from '@/server/services/connected-accounts'

const connectedAccountRoutes = new Hono()

/** Public origin for OAuth redirect URIs (PUBLIC_URL → X-Forwarded → req).
 *  Mirrors the email-accounts route — the OAuth connect/callback live there. */
function publicOrigin(c: Context): string {
  if (process.env.PUBLIC_URL) return new URL(config.publicUrl).origin
  const fwdProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
  const fwdHost = (c.req.header('x-forwarded-host') ?? c.req.header('host'))?.split(',')[0]?.trim()
  if (fwdHost) return `${fwdProto || 'https'}://${fwdHost}`
  return new URL(c.req.url).origin
}

// GET /api/connected-accounts — every connected account with its capabilities.
connectedAccountRoutes.get('/', async (c) => {
  return c.json({ accounts: await listConnectedAccounts() })
})

// GET /api/connected-accounts/providers — providers merged by type across the
// email + contacts registries, plus the OAuth redirect URI to register.
connectedAccountRoutes.get('/providers', async (c) => {
  return c.json({
    providers: await listConnectedProviders(),
    redirectUri: `${publicOrigin(c)}/api/email-accounts/oauth/callback`,
  })
})

// PATCH /api/connected-accounts/:id — send mode (email) / allow-list.
connectedAccountRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ sendMode?: 'direct' | 'approval'; allowedKinIds?: string[] | null }>()
  try {
    if (body.sendMode) await setAccountSendMode(id, body.sendMode)
    if (body.allowedKinIds !== undefined) await setAccountAllowList(id, body.allowedKinIds)
    if (!body.sendMode && body.allowedKinIds === undefined) {
      return c.json({ error: { code: 'INVALID_INPUT', message: 'Nothing to update' } }, 400)
    }
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: { code: 'NOT_FOUND', message: err instanceof Error ? err.message : 'Not found' } }, 404)
  }
})

// DELETE /api/connected-accounts/:id — disconnect (removes all capabilities).
connectedAccountRoutes.delete('/:id', async (c) => {
  await deleteConnectedAccount(c.req.param('id'))
  return c.json({ ok: true })
})

export { connectedAccountRoutes }
