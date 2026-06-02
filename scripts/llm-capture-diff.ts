/**
 * llm-capture-diff.ts — compare two captures produced by llm-capture-proxy.ts.
 *
 *   bun scripts/llm-capture-diff.ts claude-code kinbot
 *
 * Prints a side-by-side of the FIRST request from each (the discriminating
 * config: thinking, betas, temperature, max_tokens, system size, tool count),
 * then per-capture aggregates over the whole run (tool-calls/step proxy,
 * thinking-on rate, context growth). This is where we confirm — or kill — the
 * "is it even the same thinking knob?" question with ground truth.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Fp {
  n: number
  path: string
  status: number
  model: string | null
  stream: boolean | null
  temperature: number | null
  max_tokens: number | null
  thinking: { type?: string; budget_tokens?: number } | null
  topLevelKeys: string[]
  betaQuery: string | null
  headers: Record<string, string>
  system: { shape: string; blocks: number; totalChars: number; perBlockChars: number[]; hash: string | null }
  tools: { count: number; totalChars: number; hash: string | null; names: string[] }
  messages: { count: number; roleCounts: Record<string, number>; totalChars: number }
  cacheBreakpoints: number
  toolBlocks?: { toolUse: number; toolResult: number }
}

function load(label: string): Fp[] {
  const path = join(process.cwd(), 'data', 'llm-capture', label, 'fingerprints.jsonl')
  if (!existsSync(path)) {
    console.error(`No capture found at ${path}`)
    process.exit(1)
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Fp)
}

const [labelA, labelB] = [process.argv[2] ?? 'claude-code', process.argv[3] ?? 'kinbot']
const a = load(labelA)
const b = load(labelB)

function thinkingStr(fp: Fp | undefined): string {
  if (!fp) return '—'
  return fp.thinking ? `${fp.thinking.type}/${fp.thinking.budget_tokens ?? '?'}` : 'OFF (no thinking param)'
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function row(field: string, va: string, vb: string): void {
  const same = va === vb
  const mark = same ? '  ' : '≠ '
  console.log(`${mark}${pad(field, 22)} ${pad(va, 40)} ${vb}`)
}

console.log('\n══════════════ FIRST REQUEST (step 1) — the config that matters ══════════════\n')
console.log(`  ${pad('field', 22)} ${pad(labelA, 40)} ${labelB}`)
console.log('  ' + '─'.repeat(80))
const fa = a[0]
const fb = b[0]
row('model', String(fa?.model), String(fb?.model))
row('thinking', thinkingStr(fa), thinkingStr(fb))
row('temperature', String(fa?.temperature), String(fb?.temperature))
row('max_tokens', String(fa?.max_tokens), String(fb?.max_tokens))
row('anthropic-beta', fa?.headers['anthropic-beta'] ?? '—', fb?.headers['anthropic-beta'] ?? '—')
row('beta query', String(fa?.betaQuery), String(fb?.betaQuery))
row('user-agent', fa?.headers['user-agent'] ?? '—', fb?.headers['user-agent'] ?? '—')
row('top-level keys', (fa?.topLevelKeys ?? []).join(','), (fb?.topLevelKeys ?? []).join(','))
row('system shape', fa?.system.shape ?? '—', fb?.system.shape ?? '—')
row('system blocks', String(fa?.system.blocks), String(fb?.system.blocks))
row('system chars', String(fa?.system.totalChars), String(fb?.system.totalChars))
row('tool count', String(fa?.tools.count), String(fb?.tools.count))
row('tool schema chars', String(fa?.tools.totalChars), String(fb?.tools.totalChars))
row('cache breakpoints', String(fa?.cacheBreakpoints), String(fb?.cacheBreakpoints))

console.log('\n  Tools only in', labelA + ':', fa?.tools.names.filter((n) => !fb?.tools.names.includes(n)).join(', ') || '(none)')
console.log('  Tools only in', labelB + ':', fb?.tools.names.filter((n) => !fa?.tools.names.includes(n)).join(', ') || '(none)')

function agg(label: string, fps: Fp[]): void {
  const n = fps.length
  if (n === 0) return
  const thinkingOn = fps.filter((f) => f.thinking != null).length
  const budgets = fps.filter((f) => f.thinking?.budget_tokens).map((f) => f.thinking!.budget_tokens!)
  const avgBudget = budgets.length ? Math.round(budgets.reduce((x, y) => x + y, 0) / budgets.length) : 0
  const firstMsgs = fps[0]!.messages.count
  const lastMsgs = fps[n - 1]!.messages.count
  const firstChars = fps[0]!.messages.totalChars
  const lastChars = fps[n - 1]!.messages.totalChars

  // Real batching signal: tool_result BLOCKS are cumulative in the body. The
  // delta between consecutive requests = tool calls executed in the prior step
  // (parallel calls pack into one user message, so message count can't see them).
  const tr = (f: Fp) => f.toolBlocks?.toolResult ?? 0
  const totalToolCalls = Math.max(0, ...fps.map(tr))
  let maxBatch = 0
  const stepBatches: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const delta = tr(fps[i + 1]!) - tr(fps[i]!)
    if (delta > 0) {
      stepBatches.push(delta)
      if (delta > maxBatch) maxBatch = delta
    }
  }
  const callsPerStep = stepBatches.length ? (stepBatches.reduce((a, b) => a + b, 0) / stepBatches.length).toFixed(2) : 'n/a'
  const batched = stepBatches.filter((d) => d > 1).length

  console.log(`\n  ── ${label} (${n} requests = LLM round-trips) ──`)
  console.log(`     thinking ON:        ${thinkingOn}/${n} requests  (avg budget ${avgBudget})`)
  console.log(`     LLM round-trips:    ${n}                ← fewer = faster`)
  console.log(`     total tool calls:   ${totalToolCalls}`)
  console.log(`     tool calls/step:    ${callsPerStep}   (max batch in one step: ${maxBatch}; steps that batched >1: ${batched}/${stepBatches.length})  ← higher = better`)
  console.log(`     message count:      ${firstMsgs} → ${lastMsgs}`)
  console.log(`     message bytes:      ${firstChars} → ${lastChars}  (${(lastChars / 1000).toFixed(0)}KB at end)`)
  console.log(`     system chars:       ${fps[0]!.system.totalChars}`)
}

console.log('\n══════════════ AGGREGATES OVER THE RUN ══════════════')
agg(labelA, a)
agg(labelB, b)
console.log('')
