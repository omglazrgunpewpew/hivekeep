import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { agents } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { resolveAgentId } from '@/server/services/agent-resolver'
import {
  createApiRequest,
  getApiRequest,
  waitForApiReply,
  parseAllowedModes,
} from '@/server/services/external-api'
import { config } from '@/server/config'
import { MAX_MESSAGE_LENGTH } from '@/shared/constants'
import { v4 as uuid } from 'uuid'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:external-api')

// Stable third-party contract. Auth is the bearer branch in authMiddleware, which
// sets `apiClient` on the context for every /api/v1/* request.
const externalApiRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/v1/agents — Agents this key may target (discovery).
externalApiRoutes.get('/agents', async (c) => {
  const client = c.get('apiClient')!
  const rows = client.agentId
    ? db.select({ id: agents.id, slug: agents.slug, name: agents.name }).from(agents).where(eq(agents.id, client.agentId)).all()
    : db.select({ id: agents.id, slug: agents.slug, name: agents.name }).from(agents).all()
  return c.json({ agents: rows })
})

// POST /api/v1/agents/:agentId/messages — send a message, optionally wait for the reply.
externalApiRoutes.post('/agents/:agentId/messages', async (c) => {
  const client = c.get('apiClient')!
  const agentId = resolveAgentId(c.req.param('agentId'))
  if (!agentId) {
    return c.json({ error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } }, 404)
  }
  if (client.agentId && client.agentId !== agentId) {
    return c.json({ error: { code: 'AGENT_SCOPE_VIOLATION', message: 'This key is not allowed to target this Agent' } }, 403)
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    content?: string
    conversationId?: string
    newConversation?: boolean
    mode?: string
    waitTimeoutMs?: number
  }

  // Isolated threads land in P2. Reject explicitly so callers get a clear signal
  // rather than a silent fall-through to the main timeline.
  if (body.conversationId || body.newConversation) {
    return c.json({ error: { code: 'ISOLATED_UNAVAILABLE', message: 'Isolated conversations are not available yet' } }, 400)
  }

  const allowedModes = parseAllowedModes(client)
  if (!allowedModes.includes('main')) {
    return c.json({ error: { code: 'MODE_NOT_ALLOWED', message: 'This client may not post to the main timeline' } }, 403)
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return c.json({ error: { code: 'EMPTY_MESSAGE', message: 'Message content required' } }, 400)
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: { code: 'MESSAGE_TOO_LONG', message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` } }, 400)
  }

  const wait = body.mode === 'wait'
  const requestId = uuid()

  // Attribute the message to the declared client so the Agent knows who is
  // speaking, mirroring the channel sender prefix.
  const { id: queueItemId } = await enqueueMessage({
    agentId,
    messageType: 'user',
    content: `[${client.name}] ${content}`,
    sourceType: 'api',
    sourceId: client.id,
    requestId,
  })
  await createApiRequest({ requestId, clientId: client.id, agentId, queueItemId })

  log.debug({ agentId, clientId: client.id, requestId, wait }, 'External API message enqueued')

  if (wait) {
    const timeout = Math.min(
      body.waitTimeoutMs ?? config.externalApi.waitTimeoutMsDefault,
      config.externalApi.waitTimeoutMsMax,
    )
    const result = await waitForApiReply(requestId, timeout)
    if (result?.status === 'done') {
      return c.json({ requestId, status: 'done', reply: result.reply, conversationId: null })
    }
    if (result?.status === 'error') {
      return c.json({ requestId, status: 'error', error: result.error, conversationId: null }, 200)
    }
    // Timed out — caller polls GET /requests/:requestId.
    return c.json({ requestId, status: 'pending', conversationId: null }, 202)
  }

  return c.json({ requestId, status: 'pending', conversationId: null }, 202)
})

// GET /api/v1/requests/:requestId — poll a request's status/reply.
externalApiRoutes.get('/requests/:requestId', (c) => {
  const client = c.get('apiClient')!
  const result = getApiRequest(c.req.param('requestId'), client.id)
  if (!result) {
    return c.json({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found' } }, 404)
  }
  return c.json(result)
})

export { externalApiRoutes }
