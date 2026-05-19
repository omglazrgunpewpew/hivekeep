---
title: Plugins Overview
description: Extend KinBot with custom tools, providers, channels, and hooks.
---

KinBot's plugin system lets you extend functionality without modifying core code. Drop a folder into `plugins/` and get new capabilities instantly.

## What Plugins Can Do

A single plugin can contribute one or more of these:

| Type | Description |
|------|-------------|
| **Tools** | New AI-callable functions for Kins (weather, SMS, RSS...) |
| **Providers** | Custom LLM, embedding, image, or search providers |
| **Channels** | New messaging platforms |
| **Hooks** | Intercept lifecycle events (before/after chat, tool calls...) |

## Design Principles

1. **Low barrier to entry** — A plugin is a folder with a manifest and a TypeScript file
2. **TypeScript-first** — Compiled by Bun at load time, no separate build step
3. **Safe by default** — Plugins declare permissions; users approve before activation
4. **Kin-scoped** — Enable plugins globally or per-Kin
5. **Compatible** — Built-in tools remain unchanged; plugins use the same patterns

## Managing Plugins

Plugins are admin-only and managed exclusively from the UI: **Settings → Plugins** lets an admin browse the npm marketplace, install, enable/disable, configure, and uninstall plugins. The UI auto-generates settings forms from the plugin's `configSchema`.

Kins cannot install or manage plugins themselves — that capability was intentionally removed to keep the attack surface admin-gated.

## Plugin Lifecycle

```
Server Start
  → Scan plugins/ directory
  → Validate each plugin.json
  → Register discovered plugins (not yet activated)
  → Activate globally-enabled plugins
  → For each Kin, activate Kin-specific plugins
```

### Enable/Disable Levels

Plugins have two levels of enablement:

- **Global** — Plugin is active at the platform level. Its providers, channels, and hooks are registered.
- **Per-Kin** — Plugin's tools are available to specific Kins. Configured in each Kin's settings.

### Hot Reload

- **Config changes** — Applied immediately (no restart). Plugin deactivates, re-initializes with new config, then activates.
- **Code changes** — Require clicking **Reload Plugins** or restarting KinBot.
- **Manifest changes** — Require reload.

## Installation Methods

| Method | How | Use Case |
|--------|-----|----------|
| **npm marketplace** | Settings → Plugins → Browse → search → Install | Published plugins (any package tagged with the `kinbot-plugin` keyword) |
| **Git URL** | Settings → Plugins → Install from URL | Unpublished, private, or in-development plugins |
| **Manual** | Drop a folder into `plugins/` | Local development; managed entirely by hand |

See [Developing Plugins](/kinbot/docs/plugins/developing/) for the full development guide.

## Next Steps

- [Developing Plugins](/kinbot/docs/plugins/developing/) — Build your first plugin
- [Plugin API](/kinbot/docs/plugins/api/) — Full API reference
