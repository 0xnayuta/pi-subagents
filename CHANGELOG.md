# Changelog

## [0.1.0] - 2026-05-07

### Added

**Core Features**
- `subagent` tool with minimal schema: `agent` and `task` parameters only
- Five built-in readonly agents: `explorer`, `researcher`, `reviewer`, `implementer`, `tester`
- Markdown frontmatter agent definition with comma-separated tools list
- User-defined agents support via `~/.pi/agent/agents/` and `.pi/agents/`
- Foreground synchronous execution with timeout control

**Safety Features**
- Recursive depth protection: `maxSubagentDepth = 1` by default
- Child agents cannot call `subagent` tool (depth guard)
- Output sanitization: removes API keys, tokens, headers, stack traces
- All built-in agents default to `readonly: true`
- Write tools (`edit`, `write`, `bash`) filtered in readonly agents

**Error Handling**
- Structured error codes: `INVALID_INPUT`, `SUBAGENTS_DISABLED`, `UNKNOWN_AGENT`, `SUBAGENT_DISABLED`, `SUBAGENT_DEPTH_EXCEEDED`, `SUBAGENT_TIMEOUT`, `SUBAGENT_FAILED`, `SUBAGENT_OUTPUT_TRUNCATED`

### Configuration

```json
{
  "enabled": true,
  "maxSubagentDepth": 1,
  "timeoutMs": 120000,
  "allowWriteSubagents": false
}
```

### Removed (MVP Scope)

- ❌ Background/async jobs
- ❌ Chain workflow
- ❌ Parallel execution
- ❌ Intercom/contact_supervisor
- ❌ Worktree management
- ❌ TUI widgets
- ❌ Slash commands
- ❌ Skills injection
- ❌ Model fallback
