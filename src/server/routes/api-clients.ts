import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { Context, Next } from 'hono'
import { db } from '@/server/db/index'
import { apiClients, apiKeys, userProfiles, agents } from '@/server/db/schema'
import { mintApiKey, countClientConversations, listClientConversations, getClientConversationMessages } from '@/server/services/external-api'
import { v4 as uuid } from 'uuid'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:api-clients')

// Management surface for external API clients. Cookie-authed, admin only.
const apiClientRoutes = new Hono<{ Variables: AppVariables }>()

const VALID_MODES = ['main', 'isolated'] as const

const requireAdmin = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  const currentUser = c.get('user')
  const profile = db.select({ role: userProfiles.role }).from(userProfiles).where(eq(userProfiles.userId, currentUser.id)).get()
  if (!profile || profile.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } }, 403)
  }
  await next()
}

apiClientRoutes.use('*', requireAdmin)

function serializeClient(client: typeof apiClients.$inferSelect, keys: (typeof apiKeys.$inferSelect)[]) {
  return {
    id: client.id,
    name: client.name,
    description: client.description,
    agentId: client.agentId,
    allowedModes: JSON.parse(client.allowedModes) as string[],
    rateLimitPerMin: client.rateLimitPerMin,
    status: client.status,
    conversationCount: countClientConversations(client.id),
    createdAt: client.createdAt.getTime(),
    updatedAt: client.updatedAt.getTime(),
    keys: keys.map((k) => ({
      id: k.id,
      label: k.label,
      prefix: k.keyPrefix,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.getTime() : null,
      revokedAt: k.revokedAt ? k.revokedAt.getTime() : null,
      createdAt: k.createdAt.getTime(),
    })),
  }
}

function sanitizeModes(input: unknown): string[] {
  if (!Array.isArray(input)) return ['main', 'isolated']
  const modes = input.filter((m): m is string => typeof m === 'string' && VALID_MODES.includes(m as (typeof VALID_MODES)[number]))
  return modes.length > 0 ? Array.from(new Set(modes)) : ['main', 'isolated']
}

// GET /api/api-clients — list clients with their keys (no secrets).
apiClientRoutes.get('/', (c) => {
  const clients = db.select().from(apiClients).orderBy(desc(apiClients.createdAt)).all()
  const result = clients.map((client) => {
    const keys = db.select().from(apiKeys).where(eq(apiKeys.clientId, client.id)).orderBy(desc(apiKeys.createdAt)).all()
    return serializeClient(client, keys)
  })
  return c.json({ clients: result })
})

// POST /api/api-clients — declare a client.
apiClientRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    description?: string
    agentId?: string | null
    allowedModes?: unknown
    rateLimitPerMin?: number | null
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'A name is required' } }, 400)
  }
  if (body.agentId) {
    const exists = db.select({ id: agents.id }).from(agents).where(eq(agents.id, body.agentId)).get()
    if (!exists) {
      return c.json({ error: { code: 'AGENT_NOT_FOUND', message: 'Target Agent not found' } }, 400)
    }
  }
  const id = uuid()
  const now = new Date()
  db.insert(apiClients).values({
    id,
    name,
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
    ownerUserId: user.id,
    agentId: body.agentId ?? null,
    allowedModes: JSON.stringify(sanitizeModes(body.allowedModes)),
    rateLimitPerMin: typeof body.rateLimitPerMin === 'number' && body.rateLimitPerMin > 0 ? Math.floor(body.rateLimitPerMin) : null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }).run()
  log.info({ clientId: id, name }, 'External API client created')
  const client = db.select().from(apiClients).where(eq(apiClients.id, id)).get()!
  return c.json(serializeClient(client, []), 201)
})

// PATCH /api/api-clients/:id — update a client.
apiClientRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(apiClients).where(eq(apiClients.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } }, 404)
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    description?: string | null
    agentId?: string | null
    allowedModes?: unknown
    rateLimitPerMin?: number | null
    status?: string
  }
  const patch: Partial<typeof apiClients.$inferInsert> = { updatedAt: new Date() }
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (body.description !== undefined) patch.description = typeof body.description === 'string' ? body.description.trim() || null : null
  if (body.agentId !== undefined) {
    if (body.agentId) {
      const exists = db.select({ id: agents.id }).from(agents).where(eq(agents.id, body.agentId)).get()
      if (!exists) return c.json({ error: { code: 'AGENT_NOT_FOUND', message: 'Target Agent not found' } }, 400)
    }
    patch.agentId = body.agentId ?? null
  }
  if (body.allowedModes !== undefined) patch.allowedModes = JSON.stringify(sanitizeModes(body.allowedModes))
  if (body.rateLimitPerMin !== undefined) patch.rateLimitPerMin = typeof body.rateLimitPerMin === 'number' && body.rateLimitPerMin > 0 ? Math.floor(body.rateLimitPerMin) : null
  if (body.status === 'active' || body.status === 'disabled') patch.status = body.status

  db.update(apiClients).set(patch).where(eq(apiClients.id, id)).run()
  const updated = db.select().from(apiClients).where(eq(apiClients.id, id)).get()!
  const keys = db.select().from(apiKeys).where(eq(apiKeys.clientId, id)).orderBy(desc(apiKeys.createdAt)).all()
  return c.json(serializeClient(updated, keys))
})

// DELETE /api/api-clients/:id — remove a client (cascades keys + requests).
apiClientRoutes.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.select({ id: apiClients.id }).from(apiClients).where(eq(apiClients.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } }, 404)
  }
  db.delete(apiClients).where(eq(apiClients.id, id)).run()
  log.info({ clientId: id }, 'External API client deleted')
  return c.json({ ok: true })
})

// POST /api/api-clients/:id/keys — mint a key. Returns the full key ONCE.
apiClientRoutes.post('/:id/keys', async (c) => {
  const id = c.req.param('id')
  const existing = db.select({ id: apiClients.id }).from(apiClients).where(eq(apiClients.id, id)).get()
  if (!existing) {
    return c.json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } }, 404)
  }
  const body = (await c.req.json().catch(() => ({}))) as { label?: string }
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'Default'
  const minted = await mintApiKey(id, label)
  log.info({ clientId: id, keyId: minted.id }, 'External API key minted')
  return c.json({ id: minted.id, label, prefix: minted.prefix, fullKey: minted.fullKey }, 201)
})

// POST /api/api-clients/:id/keys/:keyId/revoke — soft-revoke a key.
apiClientRoutes.post('/:id/keys/:keyId/revoke', (c) => {
  const { id, keyId } = c.req.param()
  const key = db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).get()
  if (!key || key.clientId !== id) {
    return c.json({ error: { code: 'KEY_NOT_FOUND', message: 'Key not found' } }, 404)
  }
  if (key.revokedAt) {
    return c.json({ error: { code: 'ALREADY_REVOKED', message: 'Key already revoked' } }, 409)
  }
  db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId)).run()
  log.info({ clientId: id, keyId }, 'External API key revoked')
  return c.json({ ok: true })
})

// GET /api/api-clients/:id/conversations — list a client's isolated threads (read-only audit).
apiClientRoutes.get('/:id/conversations', (c) => {
  const id = c.req.param('id')
  const exists = db.select({ id: apiClients.id }).from(apiClients).where(eq(apiClients.id, id)).get()
  if (!exists) {
    return c.json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } }, 404)
  }
  return c.json({ conversations: listClientConversations(id) })
})

// GET /api/api-clients/:id/conversations/:conversationId/messages — read-only transcript.
apiClientRoutes.get('/:id/conversations/:conversationId/messages', (c) => {
  const { id, conversationId } = c.req.param()
  const messages = getClientConversationMessages(id, conversationId)
  if (!messages) {
    return c.json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } }, 404)
  }
  return c.json({ messages })
})

export { apiClientRoutes }
