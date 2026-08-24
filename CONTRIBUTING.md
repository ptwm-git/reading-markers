# Contributing to Reading Markers

Thank you for helping improve Reading Markers.

## Report a problem

Use the bug report form in GitHub Issues. Include the Reading Markers version, Obsidian version, operating system, affected view, and the smallest set of steps that reproduces the problem.

Do not attach private notes or Vault data. Replace personal content with a minimal sample that shows the same behavior.

## Propose a change

Open an issue before implementing a large behavior change. Reading Markers keeps its Markdown format and user workflow intentionally small, so proposals should describe the reading problem being solved and any effect on existing markers.

## Verify a code change

Install the locked dependencies and run the complete local Gate:

```bash
npm ci
npm run release:check
```

Changes to marker parsing or note mutation should include focused tests. Changes to user-facing behavior should also be verified in both editing view and Reading view when applicable.
