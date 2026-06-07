---
title: Tools
description: Give your Agents capabilities with built-in tools, MCP servers, and custom scripts.
---

Agents interact with the world through **tools** — functions they can call during conversations. Hivekeep provides 100+ built-in tools, plus support for MCP servers and custom scripts.

## Built-in tools

### Memory & Knowledge

| Tool | Description |
|---|---|
| `recall` | Semantic search across memories |
| `memorize` | Store a new memory |
| `update_memory` | Edit an existing memory |
| `forget` | Delete a memory |
| `list_memories` | Browse all memories with filters |
| `review_memories` | Review and curate memories |
| `search_history` | Full-text search through past conversation messages |
| `browse_history` | Browse messages by date range with pagination |
| `list_summaries` | List all compacting summaries (active and archived) with metadata |
| `read_summary` | Read the full text of a specific compacting summary by ID |
| `search_knowledge` | Search the knowledge base (uploaded documents) |
| `list_knowledge_sources` | List available knowledge sources |

### Web & Browsing

| Tool | Description |
|---|---|
| `web_search` | Search the web (provider configurable per Agent) |
| `browse_url` | Fetch and read a web page |
| `extract_links` | Extract all links from a URL |
| `screenshot_url` | Take a screenshot of a web page |

### Contacts

| Tool | Description |
|---|---|
| `get_contact` | Get full contact details by ID |
| `search_contacts` | Search across all contacts |
| `create_contact` | Create a new contact with identifiers |
| `update_contact` | Update contact info or add identifiers |
| `delete_contact` | Remove a contact |
| `set_contact_note` | Add private or global notes to a contact |
| `find_contact_by_identifier` | Look up a contact by platform/identifier |

### Vault & Secrets

| Tool | Description |
|---|---|
| `get_secret` | Retrieve a secret value by key |
| `create_secret` | Store a new secret |
| `update_secret` | Update an existing secret |
| `delete_secret` | Remove a secret |
| `search_secrets` | Search secrets by query |
| `redact_message` | Redact sensitive content from a chat message |
| `get_vault_entry` | Retrieve a structured vault entry |
| `create_vault_entry` | Create a structured vault entry |
| `create_vault_type` | Define a custom vault type (e.g. "WiFi Network") |
| `get_vault_attachment` | Retrieve a vault entry's attachment |

### Tasks (multi-agent)

These tools let an Agent spawn background sub-agents and manage delegated work:

| Tool | Availability | Description |
|---|---|---|
| `spawn_self` | main | Spawn a sub-agent of yourself |
| `spawn_agent` | main | Spawn a sub-agent of another Agent |
| `respond_to_task` | main | Respond to a completed/failed task |
| `cancel_task` | main | Cancel a running task |
| `list_tasks` | main | List all tasks |
| `list_active_queues` | main | List active concurrency groups with status (active/queued counts) |
| `get_task_detail` | main | Get details of a specific task |
| `report_to_parent` | sub-agent | Send progress updates to the parent |
| `update_task_status` | sub-agent | Mark the task as completed or failed (**mandatory**) |
| `request_input` | sub-agent | Ask the parent for clarification |

#### Concurrency groups

`spawn_self` and `spawn_agent` support optional concurrency control:

- **`concurrency_group`** — Queue name (e.g. `"batch-issues"`, `"api-calls"`). Tasks in the same group are limited to `concurrency_max` parallel executions.
- **`concurrency_max`** — Max concurrent tasks in the group. Required if `concurrency_group` is set. Default: 1.

Excess tasks enter `queued` status and are automatically promoted (FIFO) when a slot opens. Use `list_active_queues` to monitor queue status.

### Inter-Agent communication

| Tool | Description |
|---|---|
| `send_message` | Send a message to another Agent (request or inform) |
| `reply` | Reply to an inter-Agent request |
| `list_kins` | List all available Agents |

### Automation & Scheduling

| Tool | Description |
|---|---|
| `create_cron` | Create a scheduled recurring task |
| `update_cron` | Update a cron job |
| `delete_cron` | Remove a cron job |
| `list_crons` | List all cron jobs |
| `get_cron_journal` | View a cron's execution history |
| `trigger_cron` | Manually trigger a cron job |
| `wake_me_in` | Set a one-shot timer ("remind me in 30 minutes") |
| `cancel_wakeup` | Cancel a pending wakeup |
| `list_wakeups` | List pending wakeups |

### Mini-Apps

| Tool | Description |
|---|---|
| `create_mini_app` | Create a new mini-app |
| `update_mini_app` | Update app metadata |
| `delete_mini_app` | Delete an app |
| `list_mini_apps` | List all mini-apps |
| `write_mini_app_file` | Write a file to an app's workspace |
| `read_mini_app_file` | Read a file from an app |
| `delete_mini_app_file` | Delete a file |
| `list_mini_app_files` | List all files in an app |
| `get_mini_app_storage` | Read a persistent KV entry |
| `set_mini_app_storage` | Write a persistent KV entry |
| `delete_mini_app_storage` | Delete a KV entry |
| `list_mini_app_storage` | List all KV keys |
| `clear_mini_app_storage` | Clear all KV entries |
| `create_mini_app_snapshot` | Save a snapshot before risky changes |
| `list_mini_app_snapshots` | List available snapshots |
| `rollback_mini_app` | Restore from a snapshot |
| `get_mini_app_templates` | Browse starter templates |
| `get_mini_app_docs` | Get mini-app SDK documentation |
| `browse_mini_apps` | Browse the App Gallery (apps from all Agents) |
| `generate_mini_app_icon` | Generate an icon for an app |
| `get_mini_app_console` | Get recent console output (logs, warnings, errors) from a running mini-app |
| `edit_mini_app_file` | Edit a mini-app file by replacing exact text (single match by default, optional `replaceAll`) |
| `multi_edit_mini_app_file` | Apply multiple text replacements to a single mini-app file atomically |

### Channels

| Tool | Description |
|---|---|
| `list_channels` | List configured messaging channels |
| `list_channel_conversations` | List recent conversations on a channel |
| `send_channel_message` | Send a message to a channel |
| `create_channel` | Create a new messaging channel |
| `update_channel` | Update channel configuration |
| `delete_channel` | Delete a messaging channel |
| `activate_channel` | Activate an inactive channel |
| `deactivate_channel` | Deactivate an active channel |

### Files & Images

| Tool | Description |
|---|---|
| `store_file` | Create a shareable file (text, base64, URL, or workspace path) |
| `get_stored_file` | Get file metadata and download URL |
| `list_stored_files` | List all stored files |
| `search_stored_files` | Search files by name or description |
| `update_stored_file` | Update file metadata |
| `delete_stored_file` | Delete a stored file |
| `attach_file` | Attach a file to the current message |
| `list_image_models` | Discover image models available across configured providers (with `maxImageInputs`: 0 = text-to-image, 1 = single-image edit, N>1 = multi-reference) |
| `describe_image_model` | Fetch the tunable per-model parameters (seed, guidance, style, lora_scale, …) for a chosen model — call this before `generate_image` to populate its `params` field |
| `generate_image` | Generate an image with a chosen model. Accepts a text `prompt`, optional `imageUrls` array (source images, capped by the model's `maxImageInputs`), and optional `params` from `describe_image_model` |

#### Image generation workflow

The three image tools are designed to be chained:

1. **`list_image_models`** — see what's available across the user's configured providers. Each entry includes `maxImageInputs` so you know whether the model is text-to-image only (0), single-image edit/inpainting (1), or multi-reference (N>1, e.g. Nano Banana Pro, Flux-Kontext multi).
2. **`describe_image_model`** *(optional but recommended)* — for the model you want to use, fetch its parameter schema (each entry has `type`, `description`, `default`, and either an `enum` or `minimum`/`maximum`). Image-input fields are deliberately excluded — those are driven by `generate_image`'s `imageUrls`, not by `params`.
3. **`generate_image`** — provide `prompt`, optional `imageUrls` (one or more URLs from the conversation or a previous `generate_image` call), and optional `params` from step 2. Validation is loose on the client side: an invalid `params` value surfaces as a 422 from the upstream provider, which round-trips back as a tool error so you can self-correct on the next call.

### Webhooks

| Tool | Description |
|---|---|
| `create_webhook` | Create an incoming webhook with optional payload filtering and dispatch mode |
| `update_webhook` | Update webhook configuration, including filters and dispatch mode |
| `delete_webhook` | Remove a webhook |
| `list_webhooks` | List all webhooks with filter, dispatch, and stats info |

Webhooks support **payload filtering** to drop irrelevant events before they reach the Agent queue, saving LLM tokens. Two filter modes are available:

- **Simple mode** (`filter_mode: "simple"`): Extract a value from the JSON payload using a dot-notation path (`filter_field`, e.g. `"action"` or `"event.type"`) and match against an allowlist (`filter_allowed_values`). Case-insensitive matching.
- **Advanced mode** (`filter_mode: "advanced"`): Test the raw payload body against a regex pattern (`filter_expression`).

Set `filter_mode` to `null` to disable filtering.

#### Dispatch modes

Webhooks support two dispatch modes:

- **`conversation`** (default): The payload is injected as a message in the Agent's main conversation session.
- **`task`**: The payload spawns an autonomous sub-task with a configurable prompt template.

Task mode parameters:

| Parameter | Description |
|---|---|
| `dispatch_mode` | `"conversation"` or `"task"` |
| `task_title_template` | Template for task title. Use `{{field.path}}` placeholders resolved against the JSON payload (e.g. `"GitHub: {{action}} on #{{issue.number}}"`) |
| `task_prompt_template` | Template for the task description/prompt. Use `{{field.path}}` placeholders and `{{__payload__}}` for the full raw payload |
| `max_concurrent_tasks` | Max concurrent webhook-spawned tasks. Default: 1. `0` = unlimited. Uses the concurrency group system internally |

### Agent Management

| Tool | Description |
|---|---|
| `create_agent` | Create a new Agent |
| `update_agent` | Update an Agent's configuration |
| `delete_agent` | Delete an Agent |
| `get_agent_details` | Get full details of an Agent |

:::note
Agent management tools are **opt-in** (disabled by default). Enable them via `enabledOptInTools` in the tool config.
:::

### User Management

| Tool | Description |
|---|---|
| `list_users` | List all platform users |
| `get_user` | Get user details |
| `create_invitation` | Create a signup invitation link |

### Human-in-the-loop

| Tool | Availability | Description |
|---|---|---|
| `prompt_human` | main, sub-agent | Ask the user a question and wait for a response |
| `notify` | main, sub-agent | Send a notification to the user |

### Filesystem & Code

| Tool | Description |
|---|---|
| `read_file` | Read a text file or extract text from a PDF. Supports offset/limit for large files |
| `write_file` | Create or overwrite a file |
| `edit_file` | Replace exact text in a file. Supports `replaceAll` flag for bulk find-and-replace |
| `multi_edit` | Apply multiple text replacements to a single file atomically (all succeed or none applied) |
| `list_directory` | List files and directories with optional glob pattern filtering |
| `grep` | Regex search across files using ripgrep (with grep fallback). Supports 3 output modes: `content`, `files_with_matches`, `count`. Glob filtering, context lines, multiline mode |

:::tip[Tool selection guidance]
The system prompt includes a tool selection table that steers Agents toward structured file tools over `run_shell`:

- **Search file contents** → `grep` (not `run_shell` with grep/rg)
- **Find files by pattern** → `list_directory` with pattern (not `run_shell` with find/ls)
- **Single text replacement** → `edit_file` (not `run_shell` with sed/awk)
- **Replace all occurrences** → `edit_file` with `replaceAll=true`
- **Multiple edits, same file** → `multi_edit` (not sequential `edit_file` calls)
- **Git, builds, tests** → `run_shell`
:::

### System & Advanced

| Tool | Description |
|---|---|
| `run_shell` | Execute a shell command (main + sub-agent) |
| `http_request` | Make HTTP requests to external APIs |
| `get_platform_config` | Read current Hivekeep configuration (sensitive values redacted) |
| `get_platform_logs` | View Hivekeep platform logs (opt-in) |
| `update_platform_config` | Modify a config value in the .env file (opt-in) |
| `restart_platform` | Trigger a graceful restart of Hivekeep (opt-in) |
| `get_system_info` | Get system/platform information |
| `list_providers` | List all configured AI providers with their capabilities |
| `list_models` | List available models across providers, optionally filtered by capability (llm, image, embedding, search, rerank) |
| `execute_sql` | Run raw SQL on the database (opt-in, dangerous) |

### MCP Server Management

| Tool | Description |
|---|---|
| `add_mcp_server` | Register a new MCP server |
| `update_mcp_server` | Update MCP server configuration |
| `remove_mcp_server` | Remove an MCP server |
| `list_mcp_servers` | List configured MCP servers |

### Custom Tools

| Tool | Description |
|---|---|
| `register_tool` | Create a custom tool with a script |
| `run_custom_tool` | Execute a custom tool. Accepts an optional `timeout` parameter (ms), capped at the server max |
| `list_custom_tools` | List registered custom tools |

Custom tool execution timeout is configurable via environment variables:

- `HIVEKEEP_CUSTOM_TOOL_TIMEOUT` — default timeout (default: 30s)
- `HIVEKEEP_CUSTOM_TOOL_MAX_TIMEOUT` — maximum allowed timeout (default: 300s / 5min)

Per-invocation timeout values passed by the Agent are clamped between 1 second and the server maximum.

## Tool configuration

Each Agent has a **tool config** that controls access:

```json
{
  "disabledNativeTools": ["run_shell", "execute_sql"],
  "mcpAccess": {
    "server-id": ["*"]
  },
  "enabledOptInTools": ["create_agent", "get_platform_logs", "update_platform_config", "restart_platform"],
  "searchProviderId": "provider-id"
}
```

- **disabledNativeTools** — deny-list of native tools to hide from this Agent
- **mcpAccess** — which MCP server tools the Agent can use (`["*"]` for all tools on a server, or specific tool names)
- **enabledOptInTools** — explicitly enable tools that are disabled by default (agent management, plugin management, platform tools, `execute_sql`)
- **searchProviderId** — override the global web search provider for this Agent

Configure this in the Agent's settings page in the UI.

## Opt-in tools

Some powerful tools are **disabled by default** and must be explicitly enabled via `enabledOptInTools`:

| Tools | Why opt-in |
|---|---|
| `create_agent`, `update_agent`, `delete_agent`, `get_agent_details` | Can modify platform structure |
| All plugin management tools | Can install/remove server extensions |
| `get_platform_logs` | Exposes internal server logs |
| `update_platform_config` | Can modify server configuration |
| `restart_platform` | Can restart the entire Hivekeep process |
| `execute_sql` | Direct database access — use with extreme caution |

## Tool availability

Tools declare which contexts they're available in:

| Context | Description |
|---|---|
| **main** | The primary Agent agent in a conversation |
| **sub-agent** | A sub-agent spawned via `spawn_self` or `spawn_agent` |

Most tools are **main-only**. The following are also available to sub-agents:

- `report_to_parent`, `update_task_status`, `request_input` (sub-agent only)
- `save_run_learning`, `delete_run_learning` (sub-agent only, cron tasks only — persist lessons learned across cron runs)
- `prompt_human`, `notify`, `run_shell`, `http_request`

Sub-agents have access to standard tools (memory, web, contacts, vault, files, etc.) and **inter-Agent communication** (`send_message`, `list_kins`), but not administrative tools (cron, webhooks, channels, agent management).

When a sub-agent sends an inter-Agent message:
- **`request` type**: The task suspends (`awaiting_agent_response` status) until the recipient replies or the timeout expires (default: 5 minutes)
- **`inform` type**: Fire-and-forget, the task continues immediately
- Sub-agents can make up to 3 inter-Agent requests per task (configurable via `maxInterAgentRequests`)

## MCP servers

[Model Context Protocol](https://modelcontextprotocol.io/) servers extend Agents with external tools. Agents can even manage their own MCP connections (with user approval).

MCP servers added by an Agent start in `pending_approval` status and must be approved by an admin before they become active.

To connect an MCP server:
1. Go to Settings > MCP Servers
2. Add the server command, args, and environment variables
3. Assign it to specific Agents via their tool config (`mcpAccess`)

Agents can also manage MCP servers programmatically using `add_mcp_server`, `update_mcp_server`, `remove_mcp_server`, and `list_mcp_servers`.

## Custom tools

Agents can create their own tools by writing scripts:

1. The Agent calls `register_tool` with a name, description, and script
2. The script is stored in the Agent's workspace
3. The Agent (or other tools) can invoke it via `run_custom_tool`

This lets Agents build specialized automation without needing code changes to Hivekeep.
