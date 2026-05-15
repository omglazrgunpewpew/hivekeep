import { Hono } from 'hono'
import {
  getTicket,
  updateTicket,
  deleteTicket,
  startTicketTask,
  startTicketEnrichment,
  resolveMentions,
  RESOLVE_MENTIONS_MAX_REFS,
} from '@/server/services/tickets'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'
import { TICKET_STATUSES } from '@/shared/constants'
import type { TicketStatus } from '@/shared/types'

const log = createLogger('routes:tickets')

export const ticketRoutes = new Hono<{ Variables: AppVariables }>()

/**
 * Batch-resolve ticket mention refs from free text. Used by the chat client to
 * turn `#42` and `kinbot#42` patterns into clickable badges in a single round
 * trip per rendered message. Accepts both query strings (`?refs=a,b,c`) and
 * POST bodies (`{ refs: [...] }`) — POST is preferred when N > 10 to avoid
 * URL length limits.
 *
 * Optional `activeProjectId` resolves bare `#N` refs against a specific
 * project. The client is expected to pass the current Kin's active project id.
 */
ticketRoutes.get('/resolve-mentions', async (c) => {
  const refsParam = c.req.query('refs') ?? ''
  const refs = refsParam
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
  if (refs.length === 0) {
    return c.json({ resolutions: {} })
  }
  if (refs.length > RESOLVE_MENTIONS_MAX_REFS) {
    return c.json(
      {
        error: {
          code: 'TOO_MANY_REFS',
          message: `Too many refs (max ${RESOLVE_MENTIONS_MAX_REFS}). Use POST or split the request.`,
        },
      },
      400,
    )
  }
  const activeProjectId = c.req.query('activeProjectId') ?? null
  const resolutions = await resolveMentions(refs, { activeProjectId })
  return c.json({ resolutions })
})

ticketRoutes.post('/resolve-mentions', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const rawRefs = Array.isArray(body.refs) ? body.refs : []
  const refs = rawRefs
    .filter((r: unknown): r is string => typeof r === 'string')
    .map((r: string) => r.trim())
    .filter((r: string) => r.length > 0)
  if (refs.length > RESOLVE_MENTIONS_MAX_REFS) {
    return c.json(
      {
        error: {
          code: 'TOO_MANY_REFS',
          message: `Too many refs (max ${RESOLVE_MENTIONS_MAX_REFS}). Split the request.`,
        },
      },
      400,
    )
  }
  const activeProjectId = typeof body.activeProjectId === 'string' ? body.activeProjectId : null
  const resolutions = await resolveMentions(refs, { activeProjectId })
  return c.json({ resolutions })
})

ticketRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const ticket = await getTicket(id)
  if (!ticket) {
    return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
  }
  return c.json({ ticket })
})

ticketRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const update: {
    title?: string
    description?: string
    status?: TicketStatus
    position?: number
    tagIds?: string[]
  } = {}
  if (typeof body.title === 'string') update.title = body.title
  if (typeof body.description === 'string') update.description = body.description
  if (typeof body.status === 'string' && (TICKET_STATUSES as readonly string[]).includes(body.status)) {
    update.status = body.status as TicketStatus
  }
  if (typeof body.position === 'number' && Number.isFinite(body.position)) update.position = body.position
  if (Array.isArray(body.tagIds)) {
    update.tagIds = body.tagIds.filter((t: unknown): t is string => typeof t === 'string')
  }

  try {
    const ticket = await updateTicket(id, update)
    if (!ticket) {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    return c.json({ ticket })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    log.warn({ err }, 'updateTicket failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

ticketRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const ok = await deleteTicket(id)
  if (!ok) {
    return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
  }
  return c.json({ success: true })
})

ticketRoutes.post('/:id/start-task', async (c) => {
  const ticketId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const kinId = typeof body.kinId === 'string' ? body.kinId.trim() : ''
  if (!kinId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'kinId is required' } }, 400)
  }

  try {
    const task = await startTicketTask(ticketId, kinId)
    return c.json({ task }, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'TICKET_NOT_FOUND') {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    if (msg === 'KIN_NOT_FOUND') {
      return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
    }
    log.warn({ err }, 'startTicketTask failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})

ticketRoutes.post('/:id/enrich', async (c) => {
  const ticketId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const kinId = typeof body.kinId === 'string' ? body.kinId.trim() : ''
  const focus = typeof body.focus === 'string' && body.focus.trim().length > 0
    ? body.focus.trim()
    : undefined
  if (!kinId) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'kinId is required' } }, 400)
  }

  try {
    const task = await startTicketEnrichment(ticketId, kinId, { focus })
    return c.json({ task }, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'TICKET_NOT_FOUND') {
      return c.json({ error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } }, 404)
    }
    if (msg === 'KIN_NOT_FOUND') {
      return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
    }
    if (msg === 'ENRICHMENT_ALREADY_RUNNING') {
      return c.json(
        {
          error: {
            code: 'ENRICHMENT_ALREADY_RUNNING',
            message: 'An enrichment task is already running on this ticket.',
          },
        },
        409,
      )
    }
    log.warn({ err }, 'startTicketEnrichment failed')
    return c.json({ error: { code: 'INTERNAL', message: msg } }, 500)
  }
})
