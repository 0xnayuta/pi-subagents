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

## Developer Commands

Use `/subagents` prefix to access built-in diagnostic and monitoring commands:

### `/subagents doctor`

Run diagnostic checks on configuration, agents, and providers:

```bash
/subagents doctor
```

Checks:
- Configuration validation
- Agent discovery (builtin/user/project)
- Web tool provider availability

### `/subagents list`

List all available subagents:

```bash
/subagents list
```

Shows agents from: builtin (`agents/`), user (`~/.pi/agent/agents/`), and project (`.pi/agents/`) directories.

### `/subagents logs`

Display recent web tool activity logs:

```bash
/subagents logs                    # Show last 20 entries
/subagents logs --search          # Filter by search
/subagents logs --fetch           # Filter by fetch
/subagents logs --limit 50        # Custom limit
```

### `/subagents activity`

Interactive TUI panel for real-time activity monitoring:

```bash
/subagents activity
```

Features:
- Real-time stats display (total, success, errors, rate-limited, avg latency)
- Keyboard navigation (↑↓, PageUp/PageDown, Home/End)
- Quick actions: `r` refresh, `c` clear logs, `s` reset stats
- Press `Esc` or `Ctrl+C` to close

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

### Performance Optimizations

**Search Result Caching**: Cache search results with configurable TTL to reduce redundant API calls.

**Concurrency Limiter**: Semaphore-based throttling prevents overwhelming providers (default: 3 concurrent requests, 10 queued).

**Connection Pool**: HTTP keep-alive connection pooling for efficient network resource usage.

### Error Codes

The extension provides structured error codes with recovery suggestions:

#### Web Tool Errors

| Code | Description | Recovery |
|------|-------------|----------|
| `WEB_SEARCH_FAILED` | All providers failed | Try next provider or retry |
| `WEB_SEARCH_TIMEOUT` | Search request timed out | Retry with backoff |
| `WEB_SEARCH_NO_RESULTS` | No results returned | Check query or provider |
| `WEB_SEARCH_INVALID_QUERY` | Invalid query format | Fix query and retry |
| `PROVIDER_RATE_LIMITED` | Provider rate limit hit | Wait and retry (5s backoff) |
| `PROVIDER_UNAVAILABLE` | Provider service error | Try next provider |
| `PROVIDER_AUTH_FAILED` | Invalid/missing API key | Check API key configuration |
| `CONTENT_FETCH_FAILED` | Content fetch failed | Retry or skip |
| `CONTENT_FETCH_TIMEOUT` | Fetch timed out | Try Jina reader fallback |
| `CONTENT_FETCH_TOO_LARGE` | Response too large | Reduce scope |
| `NETWORK_ERROR` | Network connectivity error | Check network, retry |

#### Subagent Errors

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Missing required parameter or unsupported config |
| `SUBAGENTS_DISABLED` | Subagent feature is disabled |
| `UNKNOWN_AGENT` | Unknown agent name |
| `SUBAGENT_DISABLED` | This agent is disabled |
| `SUBAGENT_DEPTH_EXCEEDED` | Recursion depth exceeded (maxSubagentDepth = 1) |
| `SUBAGENT_TIMEOUT` | Execution timeout |
| `SUBAGENT_FAILED` | Subagent execution failed |
| `SUBAGENT_OUTPUT_TRUNCATED` | Output was truncated |

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
    "debug": "false",
    "cache": {
      "enabled": false,
      "maxEntries": 50,
      "ttlMs": 300000
    },
    "concurrency": {
      "maxConcurrent": 3,
      "maxQueueSize": 10
    },
    "connectionPool": {
      "maxSockets": 10,
      "maxFreeSockets": 5,
      "timeout": 60000
    },
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

**Provider Settings:**
- `provider`: `"ddgs"` | `"auto"` | `"brave"` | `"tavily"` | `"serper"` | `"openserp"` | `"searxng"`
- `providerPriority`: In auto mode, controls within-tier candidate ordering
- `searxng.baseUrl`: Must be explicitly set when using SearXNG

**Performance Settings:**
- `cache.enabled`: Enable search result caching (default: `false`)
- `cache.maxEntries`: Maximum cache entries (default: `50`)
- `cache.ttlMs`: Cache TTL in milliseconds (default: `300000` = 5 minutes)
- `concurrency.maxConcurrent`: Max concurrent requests (default: `3`)
- `concurrency.maxQueueSize`: Max queued requests (default: `10`)
- `connectionPool.maxSockets`: Max sockets per host (default: `10`)

**Debug Settings:**
- `debug`: Debug level - `"false"` (default, no output), `"minimal"` (errors only), `"verbose"` (all requests)

## Limitations

The MVP version **does not support** the following:

- ❌ background/async jobs
- ❌ chain workflow
- ❌ parallel execution
- ❌ intercom/contact_supervisor
- ❌ worktree management
- ❌ slash commands
- ❌ skills injection
- ❌ bash tool in readonly agents

## Recursion Protection

Subagents cannot invoke subagents (`maxSubagentDepth = 1`). Child processes do not register the `subagent` tool.

## Testing

```bash
pnpm test           # Run all tests
pnpm test:unit      # Run unit tests only
```

Current test coverage: 163 tests across observability, errors, cache, concurrency, commands, and web tools.
