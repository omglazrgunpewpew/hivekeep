import { Hono } from 'hono'
import { eq, and, asc, lt } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { agents, messages } from '@/server/db/schema'
import { enqueueMessage } from '@/server/services/queue'
import { resolveAgentId } from '@/server/services/agent-resolver'
import {
  createApiRequest,
  getApiRequest,
  waitForApiReply,
  parseAllowedModes,
  createApiConversation,
  resolveApiConversation,
  refreshApiConversationActivity,
  closeApiConversation,
  listApiConversations,
  getApiConversationSessionId,
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
    title?: string
    mode?: string
    waitTimeoutMs?: number
  }

  const allowedModes = parseAllowedModes(client)
  const isolated = !!(body.conversationId || body.newConversation)
  if (isolated && !allowedModes.includes('isolated')) {
    return c.json({ error: { code: 'MODE_NOT_ALLOWED', message: 'This client may not use isolated conversations' } }, 403)
  }
  if (!isolated && !allowedModes.includes('main')) {
    return c.json({ error: { code: 'MODE_NOT_ALLOWED', message: 'This client may not post to the main timeline' } }, 403)
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return c.json({ error: { code: 'EMPTY_MESSAGE', message: 'Message content required' } }, 400)
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: { code: 'MESSAGE_TOO_LONG', message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` } }, 400)
  }

  // Resolve the conversation target. No conversationId/newConversation -> main
  // timeline (sessionId stays undefined). Otherwise an isolated thread, whose
  // backing session id routes the message to the full-power quick lane.
  let sessionId: string | undefined
  let conversationId: string | null = null
  if (body.conversationId) {
    const resolved = resolveApiConversation(body.conversationId, client.id, agentId)
    if (!resolved.ok) {
      const status = resolved.code === 'CONVERSATION_CLOSED' ? 409 : 404
      return c.json({ error: { code: resolved.code, message: resolved.code === 'CONVERSATION_CLOSED' ? 'Conversation is closed' : 'Conversation not found' } }, status)
    }
    sessionId = resolved.sessionId
    conversationId = body.conversationId
  } else if (body.newConversation) {
    const created = createApiConversation({ clientId: client.id, agentId, ownerUserId: client.ownerUserId, title: body.title?.trim() || null })
    if (!created.ok) {
      return c.json({ error: { code: created.code, message: 'Too many active conversations for this client' } }, 429)
    }
    sessionId = created.sessionId
    conversationId = created.conversationId
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
    sessionId,
  })
  await createApiRequest({ requestId, clientId: client.id, agentId, conversationId, queueItemId })
  if (sessionId) refreshApiConversationActivity(sessionId)

  log.debug({ agentId, clientId: client.id, requestId, wait, isolated }, 'External API message enqueued')

  if (wait) {
    const timeout = Math.min(
      body.waitTimeoutMs ?? config.externalApi.waitTimeoutMsDefault,
      config.externalApi.waitTimeoutMsMax,
    )
    const result = await waitForApiReply(requestId, timeout)
    if (result?.status === 'done') {
      return c.json({ requestId, status: 'done', reply: result.reply, conversationId })
    }
    if (result?.status === 'error') {
      return c.json({ requestId, status: 'error', error: result.error, conversationId }, 200)
    }
    // Timed out — caller polls GET /requests/:requestId.
    return c.json({ requestId, status: 'pending', conversationId }, 202)
  }

  return c.json({ requestId, status: 'pending', conversationId }, 202)
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

// POST /api/v1/agents/:agentId/conversations — open an isolated thread.
externalApiRoutes.post('/agents/:agentId/conversations', async (c) => {
  const client = c.get('apiClient')!
  const agentId = resolveAgentId(c.req.param('agentId'))
  if (!agentId) {
    return c.json({ error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } }, 404)
  }
  if (client.agentId && client.agentId !== agentId) {
    return c.json({ error: { code: 'AGENT_SCOPE_VIOLATION', message: 'This key is not allowed to target this Agent' } }, 403)
  }
  if (!parseAllowedModes(client).includes('isolated')) {
    return c.json({ error: { code: 'MODE_NOT_ALLOWED', message: 'This client may not use isolated conversations' } }, 403)
  }
  const body = (await c.req.json().catch(() => ({}))) as { title?: string }
  const created = createApiConversation({ clientId: client.id, agentId, ownerUserId: client.ownerUserId, title: body.title?.trim() || null })
  if (!created.ok) {
    return c.json({ error: { code: created.code, message: 'Too many active conversations for this client' } }, 429)
  }
  return c.json({ conversationId: created.conversationId }, 201)
})

// GET /api/v1/agents/:agentId/conversations — list this client's threads.
externalApiRoutes.get('/agents/:agentId/conversations', (c) => {
  const client = c.get('apiClient')!
  const agentId = resolveAgentId(c.req.param('agentId'))
  if (!agentId) {
    return c.json({ error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found' } }, 404)
  }
  return c.json({ conversations: listApiConversations(client.id, agentId) })
})

// GET /api/v1/conversations/:conversationId/messages — read the thread transcript.
externalApiRoutes.get('/conversations/:conversationId/messages', (c) => {
  const client = c.get('apiClient')!
  const sessionId = getApiConversationSessionId(c.req.param('conversationId'), client.id)
  if (!sessionId) {
    return c.json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } }, 404)
  }
  const before = c.req.query('before')
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100)
  const rows = db
    .select({ id: messages.id, role: messages.role, content: messages.content, sourceType: messages.sourceType, createdAt: messages.createdAt })
    .from(messages)
    .where(before
      ? and(eq(messages.sessionId, sessionId), lt(messages.id, before))
      : eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
    .limit(limit)
    .all()
  return c.json({ messages: rows })
})

// POST /api/v1/conversations/:conversationId/close — close a thread.
externalApiRoutes.post('/conversations/:conversationId/close', (c) => {
  const client = c.get('apiClient')!
  const closed = closeApiConversation(c.req.param('conversationId'), client.id)
  if (!closed) {
    return c.json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } }, 404)
  }
  return c.json({ ok: true })
})

export { externalApiRoutes }
