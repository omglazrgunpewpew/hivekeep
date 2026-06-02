/**
 * llm-capture-proxy.ts — a tiny passthrough proxy that fingerprints the JSON
 * body of every `/v1/messages` request, then forwards it untouched (streaming
 * preserved) to the real Anthropic endpoint.
 *
 * Goal: compare what Claude Code sends vs what KinBot sends to the SAME endpoint,
 * field-by-field, WITHOUT drowning in the multi-MB message history (which is
 * ~identical across steps and cached). We never write the message content —
 * only its size — and we dedupe the big stable blobs (system prompt, tool
 * defs) by hash so a 40-step task produces a handful of small files.
 *
 * Both clients honor ANTHROPIC_BASE_URL (the Anthropic SDK reads it; neither
 * Claude Code nor KinBot's createClient pins a baseURL), so routing them through
 * here requires ZERO code change — just an env var at launch.
 *
 *   # terminal 1 — capture Claude Code
 *   bun scripts/llm-capture-proxy.ts --port 8788 --label claude-code
 *   ANTHROPIC_BASE_URL=http://localhost:8788 claude   # run your task
 *
 *   # terminal 2 — capture KinBot
 *   bun scripts/llm-capture-proxy.ts --port 8789 --label kinbot
 *   ANTHROPIC_BASE_URL=http://localhost:8789 bun run dev   # run the same task
 *
 *   # then diff the two captures
 *   bun scripts/llm-capture-diff.ts claude-code kinbot
 *
 * Output lands in:  data/llm-capture/<label>/
 *   fingerprints.jsonl   one compact line per request (diffable)
 *   system-<hash>.txt    full system prompt text, deduped by content hash
 *   tools-<hash>.json    full tool definitions, deduped by content hash
 *   full-step1.json      the entire first request body, once, for deep reads
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── args ─────────────────────────────────────────────────────────────────────

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]
  return fallback
}

const PORT = Number(arg('port', '8788'))
const LABEL = arg('label', 'capture')!
const UPSTREAM = (arg('upstream', 'https://api.anthropic.com') ?? '').replace(/\/$/, '')

// --force-thinking off          → strip the `thinking` param entirely
// --force-thinking <budget>     → force thinking enabled with that budget_tokens
// Safe to rewrite: the OAuth billing signature only covers the FIRST user
// message text, never thinking/max_tokens/temperature. Lets you equalize the
// "effort budget" across both harnesses, OR run a single-variable A/B on KinBot
// (same task, thinking on vs off) without touching any code.
const FORCE_THINKING_RAW = arg('force-thinking')
const FORCE_THINKING: 'off' | number | null =
  FORCE_THINKING_RAW == null ? null : FORCE_THINKING_RAW === 'off' ? 'off' : Number(FORCE_THINKING_RAW)

// --strip-beta <name>[,<name>] → remove these tokens from the anthropic-beta
// header before forwarding. Lets you test e.g. interleaved-thinking WITHOUT
// touching the thinking budget (stays on the working "thinking" capacity pool).
const STRIP_BETAS = (arg('strip-beta') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

const OUT_DIR = join(process.cwd(), 'data', 'llm-capture', LABEL)
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const FINGERPRINTS = join(OUT_DIR, 'fingerprints.jsonl')
const seenHashes = new Set<string>()
let requestCount = 0

// ─── helpers ────────────────────────────────────────────────────────────────

/** Fast non-crypto content hash → short hex tag, for deduping stable blobs. */
function hash(s: string): string {
  return Bun.hash(s).toString(16).slice(0, 12)
}

/** Char-length of a value as it appears on the wire (JSON), without keeping it. */
function jsonLen(v: unknown): number {
  try {
    return JSON.stringify(v)?.length ?? 0
  } catch {
    return -1
  }
}

/** Count cache_control breakpoints anywhere in a JSON blob (cheap string scan). */
function countCacheBreakpoints(raw: string): number {
  return (raw.match(/"cache_control"/g) ?? []).length
}

/**
 * Cumulative tool_use / tool_result block counts in the request body. Parallel
 * tool calls pack many tool_result blocks into ONE user message, so message
 * COUNT can't detect batching — block count can. The delta in tool_result
 * between consecutive requests = tool calls executed in the prior step; the
 * final request's count ≈ total tool calls in the run.
 */
function countToolBlocks(raw: string): { toolUse: number; toolResult: number } {
  return {
    toolUse: (raw.match(/"type":"tool_use"/g) ?? []).length,
    toolResult: (raw.match(/"type":"tool_result"/g) ?? []).length,
  }
}

function summarizeSystem(system: unknown): {
  shape: 'string' | 'array' | 'none' | 'other'
  blocks: number
  totalChars: number
  perBlockChars: number[]
  hash: string | null
  text: string | null
} {
  if (system == null) return { shape: 'none', blocks: 0, totalChars: 0, perBlockChars: [], hash: null, text: null }
  if (typeof system === 'string') {
    return { shape: 'string', blocks: 1, totalChars: system.length, perBlockChars: [system.length], hash: hash(system), text: system }
  }
  if (Array.isArray(system)) {
    const texts = system.map((b) => (b && typeof b === 'object' && typeof (b as any).text === 'string' ? (b as any).text : JSON.stringify(b)))
    const joined = texts.join('\n\n--- block ---\n\n')
    return {
      shape: 'array',
      blocks: system.length,
      totalChars: texts.reduce((a, t) => a + t.length, 0),
      perBlockChars: texts.map((t) => t.length),
      hash: hash(joined),
      text: joined,
    }
  }
  return { shape: 'other', blocks: 0, totalChars: jsonLen(system), perBlockChars: [], hash: null, text: null }
}

function summarizeTools(tools: unknown): { count: number; names: string[]; totalChars: number; hash: string | null; full: unknown } {
  if (!Array.isArray(tools)) return { count: 0, names: [], totalChars: 0, hash: null, full: null }
  const names = tools.map((t) => (t && typeof t === 'object' ? String((t as any).name ?? '?') : '?'))
  const serialized = JSON.stringify(tools)
  return { count: tools.length, names, totalChars: serialized.length, hash: hash(serialized), full: tools }
}

function summarizeMessages(messages: unknown): { count: number; roleCounts: Record<string, number>; totalChars: number } {
  if (!Array.isArray(messages)) return { count: 0, roleCounts: {}, totalChars: 0 }
  const roleCounts: Record<string, number> = {}
  for (const m of messages) {
    const role = m && typeof m === 'object' ? String((m as any).role ?? '?') : '?'
    roleCounts[role] = (roleCounts[role] ?? 0) + 1
  }
  return { count: messages.length, roleCounts, totalChars: jsonLen(messages) }
}

/**
 * Rewrite the `thinking` param per --force-thinking. Returns the (possibly
 * rewritten) body string and the original thinking value for the fingerprint.
 * No-op (returns input) when --force-thinking is unset or the body isn't JSON.
 */
function applyForceThinking(rawBody: string): { body: string; originalThinking: unknown; forced: boolean } {
  if (FORCE_THINKING == null) return { body: rawBody, originalThinking: undefined, forced: false }
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { body: rawBody, originalThinking: undefined, forced: false }
  }
  const originalThinking = body.thinking ?? null
  if (FORCE_THINKING === 'off') {
    delete body.thinking
  } else {
    const budget = FORCE_THINKING
    body.thinking = { type: 'enabled', budget_tokens: budget }
    // API constraints with extended thinking: max_tokens MUST exceed the budget,
    // and temperature MUST be 1.
    if (typeof body.max_tokens !== 'number' || body.max_tokens <= budget) {
      body.max_tokens = budget + 8192
    }
    body.temperature = 1
  }
  return { body: JSON.stringify(body), originalThinking, forced: true }
}

const BETA_HEADER = 'anthropic-beta'
const REDACT = new Set(['authorization', 'x-api-key'])

function fingerprintHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of headers.entries()) {
    const key = k.toLowerCase()
    if (REDACT.has(key)) {
      out[key] = `<redacted len=${v.length}>`
      continue
    }
    // Keep only the discriminating ones; drop noise like accept, connection, etc.
    if (
      key === BETA_HEADER ||
      key === 'anthropic-version' ||
      key === 'x-app' ||
      key === 'user-agent' ||
      key === 'anthropic-dangerous-direct-browser-access' ||
      key.startsWith('x-stainless')
    ) {
      out[key] = v
    }
  }
  return out
}

function fingerprint(rawBody: string, reqHeaders: Headers, url: URL, status: number, forcedFrom?: unknown): void {
  requestCount += 1
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return // not JSON (e.g. token endpoint) — skip
  }

  const system = summarizeSystem(body.system)
  const tools = summarizeTools(body.tools)
  const messages = summarizeMessages(body.messages)

  // Dedupe + persist the big stable blobs by content hash.
  if (system.hash && system.text && !seenHashes.has(`sys:${system.hash}`)) {
    seenHashes.add(`sys:${system.hash}`)
    writeFileSync(join(OUT_DIR, `system-${system.hash}.txt`), system.text)
  }
  if (tools.hash && tools.full && !seenHashes.has(`tools:${tools.hash}`)) {
    seenHashes.add(`tools:${tools.hash}`)
    writeFileSync(join(OUT_DIR, `tools-${tools.hash}.json`), JSON.stringify(tools.full, null, 2))
  }
  if (requestCount === 1) {
    writeFileSync(join(OUT_DIR, 'full-step1.json'), JSON.stringify(body, null, 2))
  }

  const fp = {
    n: requestCount,
    path: url.pathname + url.search,
    status,
    model: body.model ?? null,
    stream: body.stream ?? null,
    temperature: body.temperature ?? null,
    max_tokens: body.max_tokens ?? null,
    thinking: body.thinking ?? null, // <-- the key field: present? type? budget_tokens?
    ...(forcedFrom !== undefined ? { thinkingForcedFrom: forcedFrom } : {}),
    topLevelKeys: Object.keys(body).sort(),
    betaQuery: url.searchParams.get('beta'),
    headers: fingerprintHeaders(reqHeaders),
    system: { shape: system.shape, blocks: system.blocks, totalChars: system.totalChars, perBlockChars: system.perBlockChars, hash: system.hash },
    tools: { count: tools.count, totalChars: tools.totalChars, hash: tools.hash, names: tools.names },
    messages,
    cacheBreakpoints: countCacheBreakpoints(rawBody),
    toolBlocks: countToolBlocks(rawBody), // cumulative; deltas reveal real batching
    ...(STRIP_BETAS.length > 0
      ? {
          betaStripped: STRIP_BETAS,
          betaForwarded: (reqHeaders.get('anthropic-beta') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter((b) => b && !STRIP_BETAS.includes(b))
            .join(','),
        }
      : {}),
  }

  appendFileSync(FINGERPRINTS, JSON.stringify(fp) + '\n')

  // Compact live line so you can see it working.
  const thinkingStr = body.thinking ? `thinking=${body.thinking.type}/${body.thinking.budget_tokens ?? '?'}` : 'thinking=OFF'
  // eslint-disable-next-line no-console
  console.log(
    `[${LABEL}] #${requestCount} ${body.model ?? '?'} ${thinkingStr} temp=${body.temperature ?? '-'} maxTok=${body.max_tokens ?? '-'} ` +
      `sys=${system.totalChars}c/${system.blocks}b tools=${tools.count} msgs=${messages.count} (${messages.totalChars}c) beta=${fingerprintHeaders(reqHeaders)[BETA_HEADER] ?? '-'}`,
  )
}

// ─── proxy ──────────────────────────────────────────────────────────────────

const HOP_BY_HOP = new Set(['host', 'content-length', 'connection', 'transfer-encoding'])

Bun.serve({
  port: PORT,
  idleTimeout: 0, // long streaming responses
  async fetch(req) {
    const inUrl = new URL(req.url)
    const upstreamUrl = UPSTREAM + inUrl.pathname + inUrl.search

    const rawBody = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text()

    // Optionally rewrite the thinking param before forwarding (--force-thinking).
    const isMessages = inUrl.pathname.includes('/v1/messages')
    const { body: forwardBody, originalThinking, forced } =
      rawBody && isMessages ? applyForceThinking(rawBody) : { body: rawBody ?? '', originalThinking: undefined, forced: false }

    // Build clean upstream headers (drop hop-by-hop; keep auth + betas + everything else).
    const upstreamHeaders = new Headers()
    for (const [k, v] of req.headers.entries()) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue
      if (k.toLowerCase() === 'anthropic-beta' && STRIP_BETAS.length > 0) {
        const kept = v.split(',').map((s) => s.trim()).filter((b) => b && !STRIP_BETAS.includes(b))
        upstreamHeaders.set(k, kept.join(','))
        continue
      }
      upstreamHeaders.set(k, v)
    }

    let upstreamResp: Response
    try {
      upstreamResp = await fetch(upstreamUrl, {
        method: req.method,
        headers: upstreamHeaders,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : forwardBody,
        // @ts-expect-error Bun-specific: don't auto-decompress so SSE passes through verbatim
        decompress: false,
      })
    } catch (err) {
      console.error(`[${LABEL}] upstream error:`, err)
      return new Response(JSON.stringify({ error: { type: 'proxy_error', message: String(err) } }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Fingerprint only the messages endpoint; do it AFTER we have the upstream status.
    // Fingerprint the body we ACTUALLY forwarded (post-force), recording the original.
    if (rawBody && isMessages) {
      try {
        fingerprint(forwardBody, req.headers, inUrl, upstreamResp.status, forced ? originalThinking : undefined)
      } catch (err) {
        console.error(`[${LABEL}] fingerprint error:`, err)
      }
    }

    // Stream the response straight back. Strip content-length so Bun recomputes.
    const respHeaders = new Headers(upstreamResp.headers)
    respHeaders.delete('content-length')
    return new Response(upstreamResp.body, { status: upstreamResp.status, headers: respHeaders })
  },
})

console.log(`[${LABEL}] capture proxy on http://localhost:${PORT} → ${UPSTREAM}`)
if (FORCE_THINKING != null) console.log(`[${LABEL}] FORCING thinking = ${FORCE_THINKING === 'off' ? 'OFF (stripped)' : `enabled/${FORCE_THINKING}`} on every /v1/messages`)
if (STRIP_BETAS.length > 0) console.log(`[${LABEL}] STRIPPING betas from anthropic-beta header: ${STRIP_BETAS.join(', ')}`)
console.log(`[${LABEL}] writing to ${OUT_DIR}`)
console.log(`[${LABEL}] point a client at it:  ANTHROPIC_BASE_URL=http://localhost:${PORT} <command>`)
