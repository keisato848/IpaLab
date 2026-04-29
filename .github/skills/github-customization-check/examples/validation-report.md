# GitHub Customization Check Report

## Summary

- Mode: `<manual|hook>`
- Target: `.github`
- Findings: `<count>`
- Result: `<PASS|FAIL>`

## Findings

| Severity | Rule | File | Detail |
|---|---|---|---|
| High | GHC-FM-TOOLS | `.github/agents/example.agent.md` | top-level tools contains legacy alias `search/codebase` |
| Medium | GHC-SKILL-GOTCHAS | `.github/skills/example/SKILL.md` | Gotchas section has fewer than 3 bullet items |

## Required Fixes

1. Replace legacy top-level tools with official aliases: `read`, `edit`, `search`, `execute`, `agent`, `web`, `todo`.
2. Use valid MCP/extension tool names only when a concrete `server/tool` or `server/*` entry is required.
3. Replace triple-brace input placeholders with `${input:name:説明}`.
4. Add missing Skill quality sections and rerun the validator.

## Completion Criteria

- Findings count is `0`.
- The validator exits with code `0` when `-FailOnFinding` is supplied.
- No legacy prompt or tool alias patterns remain under `.github`.