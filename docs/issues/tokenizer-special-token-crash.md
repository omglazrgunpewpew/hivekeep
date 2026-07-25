# Tokenizer throws on model control tokens in message content, permanently bricking an Agent's chat

## Summary

If any text containing an OpenAI-style control token (for example `<|im_start|>`,
`<|endoftext|>`) is persisted into an Agent's message history, that Agent's main
chat stops working **permanently**. Every subsequent turn fails with:

```
⚠️ Disallowed special token found: <|im_start|>
```

The failure is self-reinforcing: the error message itself contains the offending
token and is written back into `messages` as a system row, so each retry adds
another poisoned row. There is no in-app recovery. The only fix is direct
database surgery.

This is not a hypothetical. It happened on a live instance during ordinary tool
use (an HTTP request whose response body echoed chat-template tokens), and it
took the Agent offline in both the web chat and its Discord channel until the
rows were sanitized by hand.

## Environment

- Hivekeep v1.9.0 (Docker install)
- `gpt-tokenizer@3.4.0`, encoding `o200k_base`
- SQLite backend

## Root cause

`src/shared/token-estimator.ts` calls `encode()` with no `EncodeOptions`:

```ts
encoderPromise = import('gpt-tokenizer/encoding/o200k_base').then((mod) => ({
  encode: (mod.encode as (text: string) => number[]),
}))
```

With no options, `gpt-tokenizer` uses its default special-token config, which
**disallows all special tokens** and throws rather than encoding them
(`GptEncoding.ts`, `encode()` / `countNative()`):

```ts
if (specialTokenConfig.regexPattern) {
  const match = lineToEncode.match(specialTokenConfig.regexPattern)
  if (match !== null) {
    throw new Error(`Disallowed special token found: ${match[0]}`)
  }
}
```

That default is correct for an *encoder feeding a model*, where a user-supplied
`<|im_start|>` would be a prompt-injection vector. It is wrong for a
**token counter**, which is the only way Hivekeep uses it. We do not send these
token IDs anywhere: `countTokens()` returns `.length`.

Minimal reproduction (run inside the app container):

```ts
const mod = await import('gpt-tokenizer/encoding/o200k_base')
mod.encode('hello <|im_start|> world')
// Error: Disallowed special token found: <|im_start|>

mod.encode('hello <|im_start|> world', { disallowedSpecial: new Set() })
// [ ... ] -> 8 tokens, no throw
```

Confirmed output on v1.9.0:

```
default encode THREW: Disallowed special token found: <|im_start|>
with disallowedSpecial empty: 8
```

### Why it is fatal rather than a one-off error

`countTokens()` is on the hot path for every turn:

- `src/server/services/agent-engine.ts:491` (`estimateTokens`)
- `src/server/services/compacting.ts:18`
- `src/server/services/context-preview.ts:256`

Once a poisoned row exists in `messages` (in `content` **or** in the `tool_calls`
blob), the estimator throws while sizing the prefix, the turn aborts, and
`agent-engine.ts` writes the error into history:

```ts
await db.insert(messages).values({
  ...
  content: `⚠️ ${displayError}`,
  sourceType: 'system',
})
```

`displayError` is the raw tokenizer message, token and all. So the error path
**creates a new poisoned row on every failed attempt**. Compaction cannot help:
compaction itself calls the same estimator over the same history.

Net effect: one tool result containing `<|im_start|>` permanently disables an
Agent, and the platform's own error handling makes it worse.

## Steps to reproduce

1. Have an Agent perform any tool call whose result contains `<|im_start|>` or
   another OpenAI special token (an `http_request` to an API that echoes the
   input is enough; so is `read_file` on a chat-template fixture, a scraped
   Hugging Face model card, or a prompt-injection test).
2. Let the result be persisted to `messages.tool_calls` / `messages.content`.
3. Send any further message to that Agent, from the web UI or a channel.

Actual: every turn fails with `⚠️ Disallowed special token found: <|im_start|>`,
forever, and history grows by one poisoned system row per attempt.

Expected: the token is counted as ordinary text and the conversation continues.

## Suggested fix

### 1. Do not let the counter throw (the actual bug)

`src/shared/token-estimator.ts` — pass an empty `disallowedSpecial` so special
tokens are counted as plain text instead of raising:

```ts
async function loadEncoder(): Promise<{ encode(text: string): number[] }> {
  if (!encoderPromise) {
    encoderPromise = import('gpt-tokenizer/encoding/o200k_base').then((mod) => ({
      // We only ever use the token COUNT, never the ids. Special tokens in
      // user/tool content must be counted, not rejected: the default config
      // throws on `<|im_start|>` and friends, which permanently breaks any
      // Agent whose history happens to contain one.
      encode: (text: string) =>
        (mod.encode as (t: string, o?: { disallowedSpecial?: Set<string> }) => number[])(
          text,
          { disallowedSpecial: new Set() },
        ),
    }))
  }
  return encoderPromise
}
```

Note this changes the count slightly (the literal becomes one special-token id
rather than several text tokens). That is the correct direction anyway, and the
estimator is documented as +/-5-15%.

### 2. Belt and braces: never let estimation take down a turn

Wrap the encode in a try/catch that falls back to `Math.ceil(text.length / 4)`.
A token *estimate* should never be able to abort a conversation, whatever future
tokenizer upgrade changes the throw conditions.

### 3. Stop the error path from poisoning history

In `agent-engine.ts`, sanitize `displayError` before persisting it. Even with
fix 1 in place, echoing raw provider errors verbatim into `messages` is how a
one-time failure became permanent. Something as simple as neutralizing `<|` and
`|>` in the persisted system message would have contained this incident to a
single failed turn.

### 4. Optional: sanitize-on-write for tool results

Longer term, consider neutralizing model control tokens when persisting tool
results. Beyond this crash, storing raw `<|im_start|>` in history is a
prompt-injection surface for any provider whose chat template uses those
markers.

## Recovery for anyone already hit

There is no UI path. With the server stopped or quiesced, back up the DB first,
then delete the `⚠️ Disallowed special token` system rows and neutralize the
tokens in the remaining rows. Replacing ASCII `<|` / `|>` with fullwidth
`<｜` / `｜>` (U+FF5C) keeps the content readable rather than destroying it:

```sql
-- 1. drop the self-inflicted error rows
DELETE FROM messages
 WHERE agent_id = :agentId
   AND source_type = 'system'
   AND content LIKE '%Disallowed special token%';

-- 2. neutralize the rest (content AND tool_calls)
UPDATE messages
   SET content    = replace(replace(content, '<|', '<｜'), '|>', '｜>'),
       tool_calls = replace(replace(ifnull(tool_calls, ''), '<|', '<｜'), '|>', '｜>')
 WHERE agent_id = :agentId
   AND (content LIKE '%<|%' OR content LIKE '%|>%'
        OR ifnull(tool_calls, '') LIKE '%<|%' OR ifnull(tool_calls, '') LIKE '%|>%');
```

Also check `compacting_summaries.summary` and `compacting_snapshots.summary`,
which can carry the token forward into a rebuilt context.

## Severity

High. Single tool result, no user error, permanent loss of an Agent's chat
across every channel, no in-app recovery, and the error handler amplifies it.
The fix is a two-line change in one file.
