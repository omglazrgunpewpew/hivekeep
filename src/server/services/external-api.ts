import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { db } from '@/server/db/index'
import { apiClients, apiKeys, apiRequests } from '@/server/db/schema'
import { createLogger } from '@/server/logger'

const log = createLogger('external-api')

export type ApiClientRow = typeof apiClients.$inferSelect

// ─── Keys ──────────────────────────────────────────────────────────────────────
// Token format: hk_<keyId>.<secret>. We persist only sha256(secret) plus a short
// display prefix; the full key is returned exactly once at creation.

const TOKEN_PREFIX = 'hk_'

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** Mint a new key under a client. Returns the full token ONCE — it is never
 *  recoverable afterwards (only its hash is stored). */
export async function mintApiKey(clientId: string, label: string): Promise<{ id: string; fullKey: string; prefix: string }> {
  const id = uuid()
  const secret = randomBytes(32).toString('base64url')
  const prefix = `${TOKEN_PREFIX}${id.slice(0, 8)}`
  await db.insert(apiKeys).values({
    id,
    clientId,
    label,
    keyHash: hashSecret(secret),
    keyPrefix: prefix,
    createdAt: new Date(),
  })
  return { id, fullKey: `${TOKEN_PREFIX}${id}.${secret}`, prefix }
}

export type ResolveKeyResult =
  | { ok: true; client: ApiClientRow; keyId: string }
  | { ok: false; status: 401 | 403; code: 'UNAUTHORIZED' | 'API_KEY_REVOKED' | 'CLIENT_DISABLED' }

/** Resolve a bearer token to its client, or an auth failure. Constant-time hash
 *  compare; throttled last_used_at write. */
export async function resolveApiKeyToken(token: string): Promise<ResolveKeyResult> {
  const unauthorized = { ok: false, status: 401, code: 'UNAUTHORIZED' } as const
  if (!token.startsWith(TOKEN_PREFIX)) return unauthorized
  const dot = token.indexOf('.')
  if (dot < 0) return unauthorized
  const keyId = token.slice(TOKEN_PREFIX.length, dot)
  const secret = token.slice(dot + 1)
  if (!keyId || !secret) return unauthorized

  const key = db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).get()
  if (!key) return unauthorized
  if (key.revokedAt) return { ok: false, status: 401, code: 'API_KEY_REVOKED' }

  const expected = Buffer.from(key.keyHash, 'hex')
  const actual = Buffer.from(hashSecret(secret), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return unauthorized

  const client = db.select().from(apiClients).where(eq(apiClients.id, key.clientId)).get()
  if (!client) return unauthorized
  if (client.status !== 'active') return { ok: false, status: 403, code: 'CLIENT_DISABLED' }

  // Throttle the last-used write: at most once a minute per key.
  const now = Date.now()
  if (!key.lastUsedAt || now - key.lastUsedAt.getTime() > 60_000) {
    db.update(apiKeys).set({ lastUsedAt: new Date(now) }).where(eq(apiKeys.id, key.id)).run()
  }

  return { ok: true, client, keyId: key.id }
}

// ─── Rate limiting (per client, in-memory sliding window) ───────────────────────

const rateBuckets = new Map<string, number[]>()

/** Consume one rate-limit slot for a client. Returns false if over the limit. */
export function consumeRateLimit(clientId: string, limitPerMinute: number): boolean {
  const now = Date.now()
  const recent = (rateBuckets.get(clientId) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= limitPerMinute) {
    rateBuckets.set(clientId, recent)
    return false
  }
  recent.push(now)
  rateBuckets.set(clientId, recent)
  return true
}

/** The owner user a client's turns act as. Used by the Agent engine. */
export function resolveApiClientOwner(clientId: string | null | undefined): string | null {
  if (!clientId) return null
  const row = db.select({ ownerUserId: apiClients.ownerUserId }).from(apiClients).where(eq(apiClients.id, clientId)).get()
  return row?.ownerUserId ?? null
}

// ─── Requests + reply correlation ───────────────────────────────────────────────

export interface ApiReplyPublic {
  requestId: string
  status: string
  reply: string | null
  error: { code: string; message: string } | null
  conversationId: string | null
}

function toPublic(row: typeof apiRequests.$inferSelect): ApiReplyPublic {
  return {
    requestId: row.id,
    status: row.status,
    reply: row.status === 'done' ? row.replyContent : null,
    error: row.status === 'error' && row.errorCode ? { code: row.errorCode, message: row.errorMessage ?? '' } : null,
    conversationId: row.conversationId,
  }
}

export async function createApiRequest(params: {
  requestId: string
  clientId: string
  agentId: string
  conversationId?: string | null
  queueItemId?: string | null
}): Promise<void> {
  await db.insert(apiRequests).values({
    id: params.requestId,
    clientId: params.clientId,
    agentId: params.agentId,
    conversationId: params.conversationId ?? null,
    queueItemId: params.queueItemId ?? null,
    status: 'pending',
    createdAt: new Date(),
  })
}

export function getApiRequest(requestId: string, clientId: string): ApiReplyPublic | null {
  const row = db.select().from(apiRequests).where(and(eq(apiRequests.id, requestId), eq(apiRequests.clientId, clientId))).get()
  return row ? toPublic(row) : null
}

// In-process registry of `wait` callers. Lost on restart — a waiter then resolves
// by the caller falling back to polling. NOT durable by design.
const waiters = new Map<string, (result: ApiReplyPublic) => void>()

/** Block until the request completes or the timeout elapses. Resolves to the
 *  final public state, or null on timeout (caller should poll). */
export function waitForApiReply(requestId: string, timeoutMs: number): Promise<ApiReplyPublic | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(requestId)
      resolve(null)
    }, timeoutMs)
    waiters.set(requestId, (result) => {
      clearTimeout(timer)
      waiters.delete(requestId)
      resolve(result)
    })
  })
}

function releaseWaiter(requestId: string, row: typeof apiRequests.$inferSelect): void {
  const waiter = waiters.get(requestId)
  if (waiter) waiter(toPublic(row))
}

/** Mark a request done with the Agent's reply, and release any `wait` caller. */
export async function resolveApiReply(requestId: string, replyMessageId: string, replyContent: string): Promise<void> {
  const row = db
    .update(apiRequests)
    .set({ status: 'done', replyMessageId, replyContent, completedAt: new Date() })
    .where(and(eq(apiRequests.id, requestId), eq(apiRequests.status, 'pending')))
    .returning()
    .get()
  if (row) releaseWaiter(requestId, row)
}

/** Safety net: if the turn ended without producing a reply (error/abort), fail
 *  the still-pending request so `wait`/poll surface it instead of hanging. */
export async function failPendingApiRequest(requestId: string, code: string, message: string): Promise<void> {
  const row = db
    .update(apiRequests)
    .set({ status: 'error', errorCode: code, errorMessage: message, completedAt: new Date() })
    .where(and(eq(apiRequests.id, requestId), eq(apiRequests.status, 'pending')))
    .returning()
    .get()
  if (row) releaseWaiter(requestId, row)
}

/** Allowed conversation targets for a client (parsed from the JSON column). */
export function parseAllowedModes(client: ApiClientRow): string[] {
  try {
    const parsed = JSON.parse(client.allowedModes)
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === 'string') : []
  } catch {
    log.warn({ clientId: client.id }, 'Corrupted allowed_modes JSON — defaulting to none')
    return []
  }
}
