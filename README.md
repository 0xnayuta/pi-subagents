# pi-subagents

English | [中文](./README.zh.md)

A lightweight pi extension for delegating tasks to focused child agents.

## Installation

```bash
pi install npm:pi-subagents
```

## Quick Start

After installation, use natural language to request a subagent:

```
Use explorer to find authentication-related code
```

```
Use reviewer to audit this diff
```

```
Use researcher to compare the pros and cons of REST vs GraphQL
```

## Usage

The main agent invokes subagents via the `subagent` tool:

```ts
subagent({ agent: "explorer", task: "Find authentication related code" })
```

Parameters:

- `agent`: Subagent name
- `task`: Task description

## Built-in Subagents

| Agent | Purpose | Tools |
|-------|---------|-------|
| `explorer` | Code navigation, file search, architecture analysis | read, grep, find, ls |
| `researcher` | Documentation/API research, web search | web_search, fetch_content, get_search_content |
| `reviewer` | Code review, diff inspection | read, grep, find, ls |
| `implementer` | Implementation planning, patch planning | read, grep, find, ls |
| `tester` | Test strategy, test case design | read, grep, find, ls |

All built-in agents default to **readonly** (`readonly: true`) and never perform write operations.

## Custom Subagents

Create a markdown file in `~/.pi/agent/agents/` or project `.pi/agents/`:

```markdown
---
name: custom-reviewer
description: Project-specific reviewer
readonly: true
tools: read, grep, find, ls
---

You are a custom review subagent for this project.
```

## Built-in Web Tools

This extension ships with lightweight readonly web tools for the main agent and the `researcher` subagent:

```ts
web_search({ query: "TypeScript 5.7 release notes" })
fetch_content({ url: "https://example.com/docs" })
get_search_content({ responseId: "...", urlIndex: 0 })
```

### Provider Strategy

**Zero-config out-of-the-box**: Defaults to DDGS, no API key required.

**Auto mode tiered selection** (`provider: "auto"`):

```
Commercial keyed (quality first)  →  tavily → serper → brave
OpenSERP / SearXNG              →  openserp → searxng
DDGS fallback (availability first) →  ddgs
```

In auto mode, providers are tried in this order; on failure, it automatically falls back until one succeeds.

**Explicit provider** (`provider: "ddgs"`): Uses only the specified provider, no fallback.

### Provider Comparison

| Provider | Type | Key Required | Notes |
|----------|------|-------------|-------|
| `ddgs` | Zero-config | ❌ | HTML parsing; results tagged `source: "fallback"`, max 5 results |
| `openserp` | Open/API | ✅ OPENSERP_API_KEY | Requires `enabled: true` |
| `searxng` | Self-hosted | ❌ | Requires explicit `baseUrl` endpoint |
| `tavily` | Commercial | ✅ TAVILY_API_KEY | Auto mode includes if key is present |
| `serper` | Commercial | ✅ SERPER_API_KEY | Auto mode includes if key is present |
| `brave` | Commercial | ✅ BRAVE_SEARCH_API_KEY | Auto mode includes if key is present |

### Error Codes

| Code | Description |
|------|-------------|
| `WEB_SEARCH_AUTH_REQUIRED` | Missing or invalid API key (includes HTTP 401/403) |
| `WEB_SEARCH_RATE_LIMIT` | Provider rate limit reached (HTTP 429) |
| `WEB_SEARCH_PROVIDER_ERROR` | Provider temporary error (HTTP 5xx) |
| `WEB_SEARCH_NETWORK_ERROR` | Network error (DNS, connection failure, etc.) |
| `SUBAGENT_TIMEOUT` | Single search request timeout |
| `INVALID_INPUT` | Missing query or unsupported provider value |

### Scope & Limitations

- `fetch_content` only supports `http:` / `https:` for `text/html` and `text/plain`
- Built-in web tools are not equivalent to the full `pi-web-access`
- YouTube, PDF-specific handling, GitHub clone, browser cookies/login state, and curator UI are not supported
- Results are stored in-memory only; retrieve them via `responseId` and `get_search_content`

## Configuration

Configure in `~/.pi/agent/extensions/subagent/config.json`:

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false,
  "webTools": {
    "enabled": true,
    "provider": "ddgs",
    "providerPriority": ["tavily", "serper", "brave", "openserp", "searxng", "ddgs"],
    "timeoutMs": 10000,
    "maxResponseBytes": 1048576,
    "maxContentChars": 30000,
    "maxResults": 5,
    "searxng": {
      "enabled": false,
      "baseUrl": ""
    },
    "openserp": {
      "enabled": false,
      "baseUrl": "https://api.openserp.com/search",
      "apiKeyEnv": "OPENSERP_API_KEY"
    },
    "tavily": {
      "enabled": false,
      "baseUrl": "https://api.tavily.com/search",
      "apiKeyEnv": "TAVILY_API_KEY"
    },
    "serper": {
      "enabled": false,
      "baseUrl": "https://google.serper.dev/search",
      "apiKeyEnv": "SERPER_API_KEY"
    }
  }
}
```

### Config Reference

- `provider`: `"ddgs"` | `"auto"` | `"brave"` | `"tavily"` | `"serper"` | `"openserp"` | `"searxng"`
- `providerPriority`: In auto mode, controls within-tier candidate ordering (providers not in the list are ignored)
- `searxng.baseUrl`: Must be explicitly set when using SearXNG (e.g., `http://127.0.0.1:8080`)
- Commercial provider `enabled` controls whether **explicit invocation** is allowed; auto mode auto-includes if a key is present

## Limitations

The MVP version **does not support** the following:

- ❌ background/async jobs
- ❌ chain workflow
- ❌ parallel execution
- ❌ intercom/contact_supervisor
- ❌ worktree management
- ❌ TUI widget
- ❌ slash commands
- ❌ skills injection
- ❌ bash tool in readonly agents

## Recursion Protection

Subagents cannot invoke subagents (`maxSubagentDepth = 1`). Child processes do not register the `subagent` tool.

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Missing required parameter or unsupported config value |
| `SUBAGENTS_DISABLED` | Subagent feature is disabled |
| `UNKNOWN_AGENT` | Unknown agent name |
| `SUBAGENT_DISABLED` | This agent is disabled |
| `SUBAGENT_DEPTH_EXCEEDED` | Recursion depth exceeded |
| `SUBAGENT_TIMEOUT` | Execution timeout |
| `SUBAGENT_FAILED` | Subagent execution failed |
| `SUBAGENT_OUTPUT_TRUNCATED` | Output was truncated |
