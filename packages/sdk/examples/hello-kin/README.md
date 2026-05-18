# `hello-kin` — KinBot plugin reference example

A single-file plugin demonstrating every extension point KinBot supports:

- **Tool** — `greet`, takes a `name` argument, emits a card.
- **Channel** — `echo-channel`, a no-op adapter that echoes outbound payloads.
- **Provider** — `echo`, a tiny native `LLMProvider` that streams `Echo: <last user message>`.
- **Hooks** — `beforeChat` and `afterToolCall` with their typed payloads.
- **Card action handler** — `onCardAction`.
- **Lifecycle** — `activate` / `deactivate`.

Read `index.ts` for the full code. Read [Developing Plugins](https://marlburrow.github.io/kinbot/docs/plugins/developing/) for the conceptual guide.

The example is exercised by `packages/sdk/src/example.test.ts` — every SDK change goes through that test, so this file is always loadable.

## Run it locally

Drop the folder into a KinBot install:

```bash
cp -r packages/sdk/examples/hello-kin <kinbot-checkout>/plugins/
# restart KinBot and enable it in Settings → Plugins
```
