---
title: Developing Plugins
description: Build, test, and publish KinBot plugins with the @kinbot-developer/sdk package.
---

This is the canonical guide for writing KinBot plugins. Every plugin imports everything it needs from `@kinbot-developer/sdk` — there are no KinBot-internal imports a plugin should reach into.

> The legacy plugin-store-specific `docs/plugins.md` and `PLUGIN-SPEC.md` are pointers to this page. If you're consulting them and they disagree with this guide, this guide wins.

## Quickstart

```bash
bunx create-kinbot-plugin --name hello-kin --type tools
cd hello-kin
```

The scaffolder generates a `plugin.json` manifest, an `index.ts` entry point, and a `README.md`. Drop the folder into your KinBot install's `plugins/` directory and KinBot picks it up at startup.

Or write it by hand:

```typescript
// plugins/hello-kin/index.ts
import { tool, z } from '@kinbot-developer/sdk'
import type { PluginContext, PluginExports } from '@kinbot-developer/sdk'

export default function (ctx: PluginContext): PluginExports {
  ctx.log.info('hello-kin plugin loaded')

  return {
    tools: {
      greet: {
        availability: ['main', 'sub-kin'],
        create: () =>
          tool({
            description: 'Say hi to someone.',
            inputSchema: z.object({
              name: z.string().describe('Who to greet'),
            }),
            execute: async ({ name }) => ({
              reply: `Hi ${name}, glad to meet you!`,
            }),
          }),
      },
    },
  }
}
```

```json
// plugins/hello-kin/plugin.json
{
  "$schema": "https://unpkg.com/@kinbot-developer/sdk/schemas/plugin-manifest.schema.json",
  "name": "hello-kin",
  "version": "0.1.0",
  "description": "Greet users by name.",
  "main": "index.ts",
  "kinbot": ">=0.40.0"
}
```

That's it. Restart KinBot, enable the plugin in Settings → Plugins, and Kins can call `greet({name:'Marl'})`.

## Manifest (`plugin.json`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | `[a-z0-9-]+` — unique across the install. |
| `version` | string | Semver. |
| `description` | string | Surfaced in the Plugins UI. |
| `main` | string | Entry file. Usually `index.ts`. |
| `kinbot` | semver range | KinBot host versions this plugin is compatible with. |
| `author` | string? | Optional. |
| `license` | string? | Optional. |
| `homepage` | string? | Optional. |
| `icon` | string? | Emoji or path. |
| `permissions` | string[] | `http:<host>` declarations granted by `ctx.http.fetch()`. Defaults to none. |
| `dependencies` | `Record<string, string>` | Other plugins this one depends on (semver). |
| `config` | `Record<string, PluginConfigField>` | Plugin-level config schema (renders the per-plugin settings form). |
| `channels.<platform>.configSchema` | `ChannelConfigSchema` | Optional channel config form schema declared at manifest level. |

KinBot validates the manifest at load time. A bad field fails fast and the plugin doesn't get activated.

## The Plugin Context

```ts
import type { PluginContext } from '@kinbot-developer/sdk'

interface PluginContext<Config = Record<string, unknown>> {
  config:   Config            // <Config> generic for typed config
  log:      PluginLogger       // scoped to your plugin name
  storage:  PluginStorageAPI   // key/value store, plugin-scoped
  http:     PluginHTTPClient   // fetch with permission enforcement
  vault:    PluginVaultAPI     // secrets (read permissive, write scoped)
  manifest: { name: string; version: string }
  cards:    PluginCardsAPI     // emit / update plugin cards in the chat
}
```

### `ctx.config<Config>()` — typed config

Plug your manifest config shape into the generic and `ctx.config.<field>` is fully typed:

```ts
interface MyConfig { apiKey: string; region?: 'eu' | 'us' }

export default function (ctx: PluginContext<MyConfig>) {
  const region = ctx.config.region ?? 'eu'   // typed
  // ctx.config.apiKey  ← string
}
```

The runtime never validates against the generic — KinBot already validated the values against the manifest's `config` schema before instantiating the context. The generic is purely a type-side convenience.

### `ctx.log`

Per-plugin scoped logger. Pino-backed. Both shapes work:

```ts
ctx.log.info('event happened')
ctx.log.error({ err, userId }, 'failed to fetch')
```

### `ctx.storage`

Plugin-scoped KV store. Keys are namespaced internally so two plugins with the same key don't collide.

```ts
await ctx.storage.set('counter', 42)
const n = await ctx.storage.get<number>('counter')   // → 42 | null
await ctx.storage.list('prefix:')                    // → string[]
await ctx.storage.delete('counter')
await ctx.storage.clear()                            // wipe everything this plugin stored
```

### `ctx.http`

Same shape as `fetch()`. The wrapper enforces your manifest's `permissions: ['http:<host>']` declarations — calls to undeclared hosts throw before going out.

```ts
const res = await ctx.http.fetch('https://api.example.com/weather?q=Paris')
```

### `ctx.vault`

```ts
await ctx.vault.getSecret(key)                     // read any vault key (you must know it)
await ctx.vault.setSecret(key, value, description?) // scoped: plugin:<name>:<key>
await ctx.vault.deleteSecret(key)                  // scoped
await ctx.vault.listKeys()                         // your plugin's keys, unprefixed
```

Read is permissive: you read the key your config gave you (e.g. an `authTokenVaultKey` reference KinBot persisted from a channel password field). Write / delete / list are strictly scoped to a `plugin:<your-plugin-name>:` namespace — you cannot touch another plugin's secrets or KinBot's own.

### `ctx.cards`

See the [Cards](#cards) section below.

## Tools

Tools are AI-callable functions Kins can invoke during a turn. Declare them with `tool()` from the SDK — `inputSchema` is a zod schema, the `execute` callback's argument is inferred from it.

```ts
import { tool, z } from '@kinbot-developer/sdk'

return {
  tools: {
    fetch_weather: {
      availability: ['main', 'sub-kin'],
      defaultDisabled: false,
      readOnly: true,
      concurrencySafe: true,
      create: (execCtx) =>
        tool({
          description: 'Get current weather for a location.',
          inputSchema: z.object({
            location: z.string().describe('City name (e.g. "Paris")'),
            units: z.enum(['metric', 'imperial']).optional(),
          }),
          execute: async ({ location, units = 'metric' }) => {
            // execCtx.kinId, execCtx.userId, etc. are available in the closure
            const res = await ctx.http.fetch(`https://api.example.com/?q=${location}&units=${units}`)
            return res.json()
          },
        }),
    },
  },
}
```

Available `ToolRegistration` flags:

| Flag | Default | Effect |
|---|---|---|
| `availability` | required | Which agents see the tool — `'main'`, `'sub-kin'`, or both. |
| `defaultDisabled` | `false` | If true, Kins must explicitly opt in to enable the tool. |
| `readOnly` | `false` | Declares the tool doesn't mutate state. Used by UI confirmations. |
| `concurrencySafe` | `false` | Allows KinBot to invoke this tool in parallel with other safe tools in the same step. |
| `destructive` | `false` | Marks the tool as performing irreversible operations. UI may confirm before firing. |
| `condition` | — | Predicate evaluated at resolve time. Return false to omit. |

## Channels

A channel adapter is an instance of `ChannelAdapter` exported under `channels.<platform-name>`. It owns the transport with an external messaging platform (Telegram, Discord, Twilio, custom WebSocket bot…) and translates between that platform and KinBot's `IncomingMessage` / `OutboundMessageParams` shapes.

```ts
import type {
  ChannelAdapter,
  IncomingMessageHandler,
  OutboundMessageParams,
  OutboundMessageResult,
  PluginContext,
} from '@kinbot-developer/sdk'

export default function (ctx: PluginContext) {
  const adapter: ChannelAdapter = {
    platform: 'my-platform',
    meta: { displayName: 'My Platform', brandColor: '#9b59b6' },
    configSchema: {
      fields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        { name: 'channelName', label: 'Channel', type: 'text', required: true },
      ],
    },
    async start(channelId, config, onMessage: IncomingMessageHandler) { /* … */ },
    async stop(channelId) { /* … */ },
    async sendMessage(channelId, config, params: OutboundMessageParams): Promise<OutboundMessageResult> {
      // …
      return { platformMessageId: 'plat-123' }
    },
    async validateConfig(config) { return { valid: true } },
    async getBotInfo(config) { return { name: 'MyBot' } },
  }
  return { channels: { 'my-platform': adapter } }
}
```

Webhook-driven adapters implement `handleInboundWebhook`. KinBot routes `POST /api/channels/plugin/<platform>/webhook/<channelId>` to it — the adapter verifies the request signature, returns the `IncomingMessage` to inject (or `null` to drop the event) plus the HTTP `Response` to send back to the platform.

Identity-switch behaviour (when a channel is transferred to a different Kin) is controlled by `identitySwitchMode`: `'native'` (adapter implements `onIdentityChange`), `'prefix'` (default — KinBot prefixes outbound messages with the new Kin's name), or `'none'`.

## Providers (LLM, Embedding, Image)

Plugin providers implement the **same** native interfaces as KinBot's built-in Anthropic / OpenAI providers. Streaming, prompt caching, thinking effort, tool calls — all of it. There is no second, simplified shape for plugins.

```ts
import type {
  LLMProvider,
  ChatRequest,
  ChatChunk,
  PluginContext,
} from '@kinbot-developer/sdk'

class MistralProvider implements LLMProvider {
  readonly type = 'mistral'
  readonly displayName = 'Mistral'
  readonly apiKeyUrl = 'https://console.mistral.ai/api-keys'
  readonly configSchema = [
    { key: 'apiKey', type: 'secret', label: 'API Key', required: true },
  ] as const

  async authenticate(config) {
    // validate the key, return { valid, error?, accountLabel? }
    return { valid: true }
  }

  async listModels(config) {
    // return [{ id, name, contextWindow, thinking?, supportsImageInput?, … }]
    return []
  }

  async *chat(model, request: ChatRequest, config): AsyncIterable<ChatChunk> {
    // stream text-delta / tool-use / thinking-delta / thinking-signature chunks,
    // finish with exactly one finish chunk carrying { reason, usage }
  }
}

export default function (ctx: PluginContext) {
  return { providers: [new MistralProvider()] }
}
```

Embedding and image providers follow the same pattern with their own interface (`EmbeddingProvider.embed`, `ImageProvider.generate`).

The plugin loader detects the family by inspecting which method the provider exposes (`chat` → LLM, `embed` → embedding, `generate` → image). The provider's `type` field is prefixed internally to `plugin:<your-plugin-name>:<type>` so it can't collide with built-ins.

## Hooks

Hook handlers receive a typed payload keyed by hook name — autocomplete on `ctx.message`, `ctx.toolResult`, etc.

```ts
import type { PluginExports, HookHandler } from '@kinbot-developer/sdk'

const auditAfterTool: HookHandler<'afterToolCall'> = (ctx) => {
  // ctx.toolName, ctx.toolArgs, ctx.toolResult are all typed
  ctx.log /* … */
}

return {
  hooks: {
    beforeChat:     (ctx) => { /* ctx.message: string */ },
    afterChat:      (ctx) => { /* ctx.response: string */ },
    beforeToolCall: (ctx) => { /* ctx.toolName, ctx.toolArgs */ },
    afterToolCall:  auditAfterTool,
  },
} satisfies PluginExports
```

Handlers may return a modified payload — it's passed to the next handler in the chain. Returning `void` keeps the previous payload.

## Cards

Plugin cards are declarative UI primitives that show up in the chat as rich live-updating messages. Useful for long-running tasks, structured data, action buttons.

```ts
import { card } from '@kinbot-developer/sdk'

const { messageId, cardInstanceId } = await ctx.cards.emit({
  kinId: execCtx.kinId,
  cardType: 'fetch-progress',
  layout: [
    card.header({ title: 'Fetching weather…', icon: 'Sparkles' }),
    card.statusBanner({ label: 'Working', animated: 'pulse', variant: 'primary' }),
    card.progress({ indeterminate: true }),
    card.actionRow([{ id: 'cancel', label: 'Cancel', variant: 'destructive' }]),
  ],
  initialState: { startedAt: Date.now() },
})

// later, push state updates that interpolate the `{{key}}` placeholders
await ctx.cards.update({ cardInstanceId, state: { phase: 'parsing' } })
```

Available primitives: `header`, `info-grid`, `status-banner`, `progress`, `collapsible`, `log-stream`, `action-row`, `markdown`, `spinner`, `badge`, `divider`. The `card.*` builders return the matching tagged variant — you can also hand-write the literals if you prefer.

Handle button clicks via `onCardAction`:

```ts
return {
  cards: { /* … */ },
  async onCardAction({ cardInstanceId, actionId, input, kinId }) {
    if (actionId === 'cancel') {
      await abortMyTask(cardInstanceId)
      return { ok: true }
    }
    return { ok: false, error: 'Unknown action' }
  },
}
```

## Lifecycle

```ts
return {
  // …

  async activate() {
    // Called when the plugin transitions to enabled.
    // Open persistent connections, start watchers, etc.
  },

  async deactivate() {
    // Called on disable / unload / hot-reload.
    // Close connections, flush state, drop subscriptions.
  },
}
```

Hot reload: editing your plugin's code triggers a full re-import; KinBot calls `deactivate()` on the old instance, instantiates the new one, then `activate()`s it.

## Local testing

Inside the KinBot tree, plugins under `plugins/<name>/` are discovered automatically — your unit tests can import them like any other module:

```ts
import { describe, it, expect } from 'bun:test'
import createPlugin from './index'

it('greets', async () => {
  const { tools } = createPlugin({ /* fake ctx */ } as any)
  const t = tools!.greet.create({ kinId: 'k', isSubKin: false })
  expect(await t.execute!({ name: 'Marl' })).toEqual({ reply: 'Hi Marl, glad to meet you!' })
})
```

For real end-to-end testing, drop your plugin folder into a KinBot install and exercise it via the chat.

## Publishing

Plugins can ship through three paths:

1. **In-tree** — drop the folder in `plugins/`. Simplest, fits internal/private plugins.
2. **Git** — push to a repo, install via the Plugins UI (`Install from Git URL`).
3. **npm** — publish under the `@your-org/` scope, install via `Install from npm`. Your `package.json` should declare `@kinbot-developer/sdk` as a peer dep so KinBot's installed version is used.

Either way, the plugin's runtime contract is the same: a default-exported function returning `PluginExports`.

## Migration

If you're moving from a plugin written against the pre-0.2 SDK (legacy `ProviderDefinition`, loose `HookContext`, `import { tool } from 'ai'`…), see [Migrating from 0.1](/kinbot/docs/plugins/migrating-from-0.1/).
