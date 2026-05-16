/**
 * Completeness guard: every tool registered in `register.ts` MUST have an
 * entry in TOOL_DOMAIN_MAP. Without one the tool is silently filtered out
 * of the Kin "Tools" settings tab (see services/kin-tools.ts:73 —
 * `if (!domain) continue`), so the user can't see it, can't disable it,
 * can't reason about it. Add this test once, never debug "where did my
 * new tool go in the UI" again.
 *
 * We parse `register.ts` as text rather than calling `registerAllTools()`
 * — that function transitively loads every tool module which would
 * cascade-fail under the per-suite mock leakage Bun's `mock.module` is
 * known for. Static analysis is robust to that.
 */
import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { TOOL_DOMAIN_MAP } from '@/shared/constants'

const REGISTER_PATH = resolve(__dirname, 'register.ts')

function extractRegisteredToolNames(): string[] {
  const src = readFileSync(REGISTER_PATH, 'utf-8')
  // Match `toolRegistry.register('name', ...)` — single-quoted names only,
  // skipping any commented-out lines.
  const names: string[] = []
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('//') || line.startsWith('*')) continue
    const m = line.match(/toolRegistry\.register\('([^']+)'/)
    if (m && m[1]) names.push(m[1])
  }
  return names
}

describe('Tool registry completeness vs TOOL_DOMAIN_MAP', () => {
  const registered = extractRegisteredToolNames()

  it('parser found a plausible number of registered tools', () => {
    // Sanity check on the regex — register.ts has well over 100 tools.
    expect(registered.length).toBeGreaterThan(50)
  })

  it("every registered tool has a TOOL_DOMAIN_MAP entry (otherwise it's invisible in the Kin Tools tab)", () => {
    const orphans: string[] = []
    for (const name of registered) {
      if (!(name in TOOL_DOMAIN_MAP)) orphans.push(name)
    }
    expect(
      orphans,
      `Add these to TOOL_DOMAIN_MAP in src/shared/constants.ts (otherwise they don't show in the Kin Tools tab): ${orphans.join(', ')}`,
    ).toEqual([])
  })

  it('TOOL_DOMAIN_MAP has no orphan entries (mapped tool no longer registered)', () => {
    const registeredSet = new Set(registered)
    const orphans: string[] = []
    for (const toolName of Object.keys(TOOL_DOMAIN_MAP)) {
      if (!registeredSet.has(toolName)) orphans.push(toolName)
    }
    expect(
      orphans,
      `Remove these stale entries from TOOL_DOMAIN_MAP — they are not in the registry: ${orphans.join(', ')}`,
    ).toEqual([])
  })
})
