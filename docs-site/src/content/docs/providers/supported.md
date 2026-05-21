---
title: Supported Providers
description: Built-in providers (LLM, embedding, image, search) shipped with KinBot.
---

KinBot ships with built-in providers across four families: language models (LLM), embeddings, image generation, and web search. Additional providers (Mistral, DeepSeek, Cohere, Voyage, …) are available as first-party plugins from the marketplace, and you can write your own via the [Custom Providers](/kinbot/docs/providers/custom/) plugin path.

## Provider Table

| Provider | LLM | Embedding | Image | Search | API Key Required |
|----------|:---:|:---------:|:-----:|:------:|:----------------:|
| [Anthropic](https://console.anthropic.com/settings/keys) | ✅ | | | | ✅ |
| [Anthropic (Claude Max)](https://claude.ai) | ✅ | | | | ❌ (OAuth) |
| [OpenAI](https://platform.openai.com/api-keys) | ✅ | ✅ | ✅ | | ✅ |
| [OpenAI (Codex CLI)](https://openai.com/index/introducing-codex/) | ✅ | | | | ❌ (OAuth) |
| [Gemini](https://aistudio.google.com/apikey) | ✅ | | ✅ | | ✅ |
| [Brave Search](https://brave.com/search/api/) | | | | ✅ | ✅ |
| [SerpAPI](https://serpapi.com/manage-api-key) | | | | ✅ | ✅ |
| [Tavily](https://app.tavily.com/home) | | | | ✅ | ✅ |
| [Perplexity Sonar](https://www.perplexity.ai/settings/api) | | | | ✅ | ✅ |

## Capabilities

- **LLM** — Chat and text completion models used for Kin conversations
- **Embedding** — Vector embedding models used for memory storage and retrieval
- **Image** — Image generation models (used by `generate_image`)
- **Search** — Web search APIs (used by `web_search` and discovered via `list_search_providers`)

## Search-provider capabilities at a glance

Search providers declare static capability flags so a Kin can pick the right one for the job. `web_search` honors what each provider supports and emits a warning when the LLM asks for something the provider doesn't expose.

| Provider | `answer` | `freshness` | `domains` | `lang` | `location` | Notes |
|---|:---:|:---:|:---:|:---:|:---:|---|
| Brave Search | ❌ | ✅ | ✅ | ✅ | ✅ | Domain filter via `site:` operators in the query. |
| SerpAPI | ❌ | ✅ | ✅ | ✅ | ✅ | Google as upstream; auth check uses `/account` (free). |
| Tavily | ✅ | ✅ | ✅ | ❌ | ❌ | Purpose-built for LLM grounding; native answer synthesis. |
| Perplexity Sonar | ✅ | ✅ | ✅ | ❌ | ❌ | LLM-with-search; recency caps at one month (`year` → `month` with warning). |

## Configuration

Providers are configured in **Settings > Providers** in the KinBot UI. Each provider requires an **API key** (except those using OAuth).

A configured search provider is automatically picked up by the `web_search` tool. To make it the default for all Kins, set it under **Settings > Models & Services > Default Search Provider** — otherwise `web_search` falls back to the first valid configured search provider.

## API Endpoints

KinBot exposes several provider management endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/providers` | List all configured providers |
| `POST` | `/api/providers` | Add a new provider (auto-tests connection unless `skipTest: true`) |
| `PATCH` | `/api/providers/:id` | Update provider config (re-tests connection unless `skipTest: true`) |
| `DELETE` | `/api/providers/:id` | Delete a provider (warns when removing the last with a given capability; never blocks) |
| `GET` | `/api/providers/types` | List all available provider types (built-in + plugin) |
| `GET` | `/api/providers/capabilities` | Check which capabilities are currently available |
| `GET` | `/api/providers/models` | List all available models across valid providers |
| `POST` | `/api/providers/test` | Test a connection without saving |
| `POST` | `/api/providers/:id/test` | Re-test an existing provider's connection |

## Minimum Setup

To use KinBot, you need at minimum:

1. **One LLM provider** — For Kin conversations (Anthropic, OpenAI, Gemini, or an OpenAI-compatible endpoint via a plugin)
2. **One embedding provider** — For memory to work (OpenAI's `text-embedding-3-small`, a plugin-contributed provider, or Ollama)

Optional but recommended:
- A **search provider** for `web_search` (Brave, SerpAPI, Tavily, or Perplexity Sonar)
- An **image provider** for `generate_image` (OpenAI or Gemini)
