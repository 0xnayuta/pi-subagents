# MVP Tests

## Running Tests

```bash
pnpm test:mvp
```

## Test Coverage

| Module | File | What it tests |
|--------|------|---------------|
| Built-in agents | `unit/builtin-agents.test.ts` | 5 agents discovery, tools, readonly |
| Config loading | `unit/config-loading.test.ts` | Defaults, web tools, error codes, schema |
| Frontmatter | `unit/frontmatter.test.ts` | Agent definition parsing |

## Principles

1. **Test MVP behavior**: each test validates one specific constraint
2. **Real code paths**: import actual modules, minimal mocking
3. **Clear naming**: `it("describes expected behavior")` format
4. **Independent tests**: each test runs standalone
5. **Meaningful assertions**: concrete checks, no vague assertions
