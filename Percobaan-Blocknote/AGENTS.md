# AI Agent Rules

- Rules that AI must follow when working on this project.
- Never make unsupported success claims.
- Reproduce problems before fixing them.
- Use one hypothesis at a time.
- Verify every fix.
- Never repeat a failed approach unless new evidence justifies it.
- After every failed debugging attempt, immediately record it in DEBUG_LOG.md.
- After a successful fix, record the root cause, final fix, and verification in DEBUG_LOG.md.
- If debugging reaches 3 consecutive failures, stop making random changes and enter investigation mode.
- If codebase-memory-mcp tool is available, use search_graph/trace_call_path to explore code structure before grepping manually or reading many files.
