# Rooms: working rules

This repo is spec-driven. Read [specs/README.md](specs/README.md) before
changing behaviour.

- **The spec comes first.** A change in behaviour starts as an edit to the
  matching file in `specs/` (add or change an acceptance criterion), then tests,
  then code. A PR that changes behaviour without a spec diff is incomplete.
- **The spec wins.** If the code contradicts an acceptance criterion, the code
  is wrong unless the spec is being changed in the same PR.
- **Cite ids in tests.** Start the test title with the criterion id:
  `it("MEM-05: …")`.
- **Mirrored rules** (lock window, quorum, clash, join gates) are implemented
  on both server and client. Change both and test both.
- **`[gap]` criteria** are known bugs. Don't silently "fix" the spec to match
  the code; fix the code, or ask.
- Before finishing, run `npm run spec:check` and `npm test` from the repo root.

## Who writes what

- The **owner** states intent and makes every product decision, including
  the open questions at the bottom of each spec.
- **Claude** drafts the criteria with `/spec` ([.claude/skills/spec](.claude/skills/spec/SKILL.md)),
  and the owner reviews the spec diff before any code is written.
- **Subagents** live in [.claude/agents/](.claude/agents/): **F** (client/),
  **B** (server/, packages/shared/), **Q** (manual QA, only when asked). They
  get the criterion ids in their task. Their personal notes stay outside the
  repo, in `~/.claude/agents/context/`.

Setup and run instructions are in [README.md](README.md).
