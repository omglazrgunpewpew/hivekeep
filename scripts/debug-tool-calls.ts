/**
 * Debug script: find the tool count threshold where the model stops calling tools
 *
 * Tests with increasing tool counts: 1, 10, 30, 50, 80, 100, 120, 152
 * Uses real KinBot system prompt + conversation history.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun run scripts/debug-tool-calls.ts
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { readFileSync } from 'fs'

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('Set ANTHROPIC_API_KEY env var')
  process.exit(1)
}

const context = JSON.parse(readFileSync('kin-context.json', 'utf-8'))
const realSystemPrompt: string = context.system
const realMessages: Array<{ role: string; content: string }> = context.messages ?? []
const contextTools: Array<{ name: string; description: string }> = context.tools ?? []

console.log(`System prompt: ${realSystemPrompt.length} chars`)
console.log(`Available context tools: ${contextTools.length}`)

function execShell(cmd: string): string {
  const proc = Bun.spawnSync(['bash', '-c', cmd])
  return proc.stdout.toString().trim()
}

function stripToolExecute(tools: Record<string, any>): Record<string, any> {
  const schemas: Record<string, any> = {}
  for (const [name, t] of Object.entries(tools)) {
    const { execute, ...rest } = t as Record<string, unknown>
    schemas[name] = rest
  }
  return schemas
}

const prompt = `Lance 3 tools indépendants en un seul step.
Les commandes:
1. echo $((RANDOM % 1000))
2. shuf -n1 /usr/share/dict/words 2>/dev/null || echo "cat"
3. date -u +%H:%M:%S

Donne moi le résultat sous la forme: ALPHA=<resultat1>, BRAVO=<resultat2>, CHARLIE=<resultat3>`

function buildTools(count: number): Record<string, any> {
  const tools: Record<string, any> = {
    run_shell: tool({
      description: 'Execute a shell command and return its output. Use this for system commands, scripts, git operations, builds, and tests.',
      inputSchema: z.object({
        command: z.string().describe('The shell command to execute'),
      }),
      execute: async ({ command }) => execShell(command),
    }),
  }

  // Add dummy tools from context (real names + descriptions)
  const dummyCount = count - 1 // -1 because run_shell is already added
  const available = contextTools.filter((t) => t.name !== 'run_shell')
  for (let i = 0; i < dummyCount && i < available.length; i++) {
    const ct = available[i]
    tools[ct.name] = tool({
      description: ct.description || `Tool: ${ct.name}`,
      inputSchema: z.object({}),
      execute: async () => `mock`,
    })
  }

  return tools
}

type ToolCallRecord = { id: string; name: string; args: unknown }

async function runTest(toolCount: number): Promise<{ toolCount: number; toolsCalled: number; hallucinated: boolean; stepCount: number }> {
  const anthropic = createAnthropic({ apiKey })
  const model = anthropic('claude-sonnet-4-20250514')

  const allTools = buildTools(toolCount)
  const stripped = stripToolExecute(allTools)
  const actualCount = Object.keys(stripped).length

  const messageHistory: Array<{ role: string; content: unknown }> = []
  // Last 20 messages from real history
  const historySlice = realMessages.slice(-20)
  for (const msg of historySlice) {
    messageHistory.push({ role: msg.role, content: msg.content })
  }
  messageHistory.push({ role: 'user', content: prompt })

  let fullContent = ''
  let totalToolCalls = 0
  let hallucinated = false
  let steps = 0

  for (let step = 0; step < 10; step++) {
    steps++

    const result = streamText({
      model,
      system: realSystemPrompt,
      messages: messageHistory as any,
      tools: stripped,
    })

    let stepText = ''
    const stepToolCalls: ToolCallRecord[] = []

    try {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          stepText += part.text
          fullContent += part.text
        } else if (part.type === 'tool-call') {
          stepToolCalls.push({ id: part.toolCallId, name: part.toolName, args: part.input })
        }
      }
    } catch (err) {
      console.log(`    ERROR: ${err instanceof Error ? err.message : String(err)}`)
      break
    }

    totalToolCalls += stepToolCalls.length

    // Detect hallucination: text with result patterns but no tools called, OR text with results in a step that also has tools
    if (stepText && /ALPHA|BRAVO|CHARLIE/i.test(stepText) && stepToolCalls.length > 0) {
      hallucinated = true
    }
    if (stepText && /ALPHA.*=.*BRAVO.*=.*CHARLIE/i.test(stepText) && totalToolCalls === 0) {
      hallucinated = true
    }

    if (stepToolCalls.length === 0) break

    // Build history
    const assistantContent: Array<{ type: string; [k: string]: unknown }> = []
    if (stepText) assistantContent.push({ type: 'text', text: stepText })
    for (const tc of stepToolCalls) {
      assistantContent.push({ type: 'tool-call', toolCallId: tc.id, toolName: tc.name, input: tc.args })
    }

    const toolResults: Array<{ type: 'tool-result'; toolCallId: string; toolName: string; output: { type: 'json'; value: string } }> = []
    for (const tc of stepToolCalls) {
      const cmd = (tc.args as { command?: string }).command
      const out = cmd ? execShell(cmd) : 'mock'
      toolResults.push({ type: 'tool-result', toolCallId: tc.id, toolName: tc.name, output: { type: 'json', value: out } })
    }

    messageHistory.push({ role: 'assistant', content: assistantContent })
    messageHistory.push({ role: 'tool', content: toolResults })
  }

  return { toolCount: actualCount, toolsCalled: totalToolCalls, hallucinated, stepCount: steps }
}

// ─── Run tests with increasing tool counts ──────────────────

const counts = [1, 10, 30, 50, 80, 100, 120, 152]

console.log('\n' + '='.repeat(70))
console.log('TOOL COUNT THRESHOLD TEST')
console.log('='.repeat(70))

const results: Array<{ toolCount: number; toolsCalled: number; hallucinated: boolean; stepCount: number }> = []

for (const count of counts) {
  process.stdout.write(`\n  Testing with ${count} tools... `)
  const result = await runTest(count)
  const status = result.toolsCalled === 0
    ? '🔴 NO TOOLS CALLED (hallucinated)'
    : result.hallucinated
      ? '🟡 Tools called but HALLUCINATED text'
      : `✅ OK (${result.toolsCalled} calls in ${result.stepCount} steps)`
  console.log(status)
  results.push(result)
}

// ─── Summary table ──────────────────────────────────────────

console.log('\n' + '='.repeat(70))
console.log('SUMMARY')
console.log('='.repeat(70))
console.log(`${'Tools'.padStart(8)} | ${'Called'.padStart(8)} | ${'Steps'.padStart(7)} | ${'Halluc'.padStart(8)} | Status`)
console.log('-'.repeat(70))
for (const r of results) {
  const status = r.toolsCalled === 0
    ? '🔴 SKIP'
    : r.hallucinated
      ? '🟡 HALLU'
      : '✅ OK'
  console.log(
    `${String(r.toolCount).padStart(8)} | ${String(r.toolsCalled).padStart(8)} | ${String(r.stepCount).padStart(7)} | ${String(r.hallucinated).padStart(8)} | ${status}`,
  )
}

console.log('\n✅ Done')
