# AGENTS.md

Before making non-trivial changes, read:

1. `AI_PROJECT_WORKFLOW.md`
2. Relevant `openspec/specs/**`
3. Relevant `openspec/changes/**`
4. Existing implementation and tests

This project uses OneSpec/OpenSpec.

For normal or complex changes:

request
→ inspect
→ ambiguity scan
→ proposal
→ design if needed
→ spec delta
→ tasks
→ approval
→ implementation
→ verification
→ acceptance
→ archive

Do not implement before approval.

Do not perform unrelated refactors.

Before declaring completion, run all applicable checks:

- tests
- lint
- typecheck
- build

## Test server cleanup

When starting an API, web server, Playwright web server, or other local process for verification, stop every process started for that verification once the check completes. Do not leave test ports or background processes running. Before stopping a process, verify that it is the test process for the current workspace so an unrelated user process is not interrupted.

Never claim a check passed unless it was actually executed.
