/**
 * @kinbot/sdk — public plugin surface for KinBot.
 *
 * Plugin authors should import everything they need from here:
 *
 *   import { tool, z } from '@kinbot/sdk'
 *
 *   export default function (ctx) {
 *     return {
 *       tools: {
 *         my_tool: tool({
 *           description: '...',
 *           inputSchema: z.object({ ... }),
 *           execute: async ({ ... }) => { ... },
 *         }),
 *       },
 *     }
 *   }
 *
 * The SDK is intentionally tiny — only the surface plugins actually consume:
 *   - `tool()`         : declarative tool helper with INPUT inferred from the schema
 *   - `asSchema()`     : normalize zod / JSON Schema / `{ jsonSchema }` wrappers
 *                        into plain JSON Schema (rarely needed by plugins, kept
 *                        for parity with KinBot's internal `tool-helper`)
 *   - `Tool`           : the typed tool definition
 *   - `JSONValue`      : recursive JSON value type
 *   - `z`              : re-export of zod, so plugins don't need their own dep
 *
 * KinBot's runtime injects the same module into the plugin loader, so a plugin
 * declaring `@kinbot/sdk` as a peer dep gets the host's version automatically
 * via workspace resolution / npm hoisting. No KinBot internal imports needed.
 */

import { z } from 'zod'

export { z }

// ─── JSON Value ──────────────────────────────────────────────────────────────

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[]

// ─── Tool ────────────────────────────────────────────────────────────────────

/**
 * A tool definition as seen by KinBot. `inputSchema` is typed as `unknown`
 * because it can be a zod schema, a JSON Schema object, or a wrapper exposing
 * `.jsonSchema`. KinBot normalizes via {@link asSchema} before any provider
 * sees it.
 *
 * The `INPUT` / `OUTPUT` generics exist for inference at the `tool({...})`
 * call site only — they are not enforced at runtime.
 */
export interface Tool<INPUT = any, OUTPUT = any> {
  description?: string
  inputSchema: unknown
  execute?: (
    args: INPUT,
    options?: { abortSignal?: AbortSignal },
  ) => OUTPUT | Promise<OUTPUT>
}

/**
 * Infer the parsed input type of a tool's `inputSchema`.
 *
 * - When the schema is a zod schema → `z.infer<SCHEMA>`.
 * - When the schema exposes a Vercel-style `_output` phantom field → that type.
 * - Fallback `unknown`.
 */
type InferToolInput<SCHEMA> =
  SCHEMA extends z.ZodType<infer T> ? T
  : SCHEMA extends { _output: infer O } ? O
  : unknown

/**
 * Declarative helper used by every tool definition. At runtime it is the
 * identity function — its only job is to give the call site typed inference
 * so the `execute` callback's first argument is strongly typed against the
 * `inputSchema`.
 */
export function tool<SCHEMA, OUTPUT = unknown>(definition: {
  description?: string
  inputSchema: SCHEMA
  execute?: (
    args: InferToolInput<SCHEMA>,
    options?: { abortSignal?: AbortSignal },
  ) => OUTPUT | Promise<OUTPUT>
}): Tool<InferToolInput<SCHEMA>, OUTPUT> {
  return definition as Tool<InferToolInput<SCHEMA>, OUTPUT>
}

export interface NormalizedSchema {
  /** JSON Schema (draft 2020-12) representation of the original input. */
  jsonSchema: Record<string, unknown>
}

/**
 * Normalize whatever `inputSchema` shape a tool was declared with into a
 * JSON Schema object.
 *
 * Recognizes:
 *   - A wrapper already exposing `.jsonSchema` (legacy `Schema` shape).
 *   - A zod schema (`_def` / `parse` / `safeParse`) — converted via
 *     `z.toJSONSchema()` from zod v4.
 *   - A plain JSON Schema object (`type` / `properties` / `$schema`).
 *
 * Falls back to `{ type: 'object', properties: {} }` when the input can't be
 * recognized — required by providers like OpenAI which reject schemas missing
 * `properties`.
 */
export function asSchema(input: unknown): NormalizedSchema {
  if (input != null && typeof input === 'object') {
    const obj = input as Record<string, unknown>

    if (
      'jsonSchema' in obj &&
      obj.jsonSchema &&
      typeof obj.jsonSchema === 'object'
    ) {
      return { jsonSchema: obj.jsonSchema as Record<string, unknown> }
    }

    if ('_def' in obj || 'parse' in obj || 'safeParse' in obj) {
      try {
        const schema = z.toJSONSchema(input as z.ZodTypeAny) as Record<string, unknown>
        return { jsonSchema: schema }
      } catch {
        // fall through to the minimal fallback
      }
    }

    if ('type' in obj || 'properties' in obj || '$schema' in obj) {
      return { jsonSchema: obj }
    }
  }
  return { jsonSchema: { type: 'object', properties: {} } }
}
