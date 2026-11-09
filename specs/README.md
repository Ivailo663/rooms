# Specs

These specs are the source of truth for what the app does. When a spec and the
code disagree, the spec wins. Either the code has a bug, or the spec was
changed on purpose and the code hasn't caught up yet.

## Workflow

1. **Spec first.** A new behaviour, or a change to an existing one, starts as an
   edit to the relevant spec. Add or change the acceptance criteria (ACs) before
   writing code. If it's a larger feature, add a file under `specs/` for it.
2. **Agree.** The spec diff gets reviewed like code. A PR that changes behaviour
   without a spec change is incomplete.
3. **Test against the AC.** Every test that checks a criterion puts the AC id at
   the start of its title:
   `it("MEM-04: rejects a join inside the lock window", …)`.
4. **Implement** until those tests pass.
5. **Check coverage.** Run `npm run spec:check` from the repo root (see below).

## Acceptance criteria format

Each criterion is one bullet that starts with a bold id:

```md
- **MEM-04** A join into a `scheduled` slot inside the lock window is rejected
  with 409 "Joining has closed for this game".
```

- An id is a domain prefix plus a two-digit number. Ids are never reused. If a
  criterion is dropped, delete it and leave the gap in the numbering.
- `[gap]` at the end of a criterion means the spec states the intended
  behaviour and the code doesn't do it yet. It's a known bug, and the spec
  describes the fix.
- `[deferred]` means agreed, but not scheduled. Don't fix it unless asked.
- `[tbd]` means to be discussed. The wording is a working draft, not agreed,
  so don't build or test against it. The current code stays until the owner
  settles it, and the spec lists what still needs refining.
- **(mirrored)** means the client re-implements the rule so the UI can predict
  the server's answer. A mirrored criterion needs a test on **both** sides.
  Disagreement between them is the bug class these tags exist to catch.

## Index

| Prefix | Spec | Covers |
| --- | --- | --- |
| ROLE | [tenancy-and-roles.md](tenancy-and-roles.md) | Tenants, roles, capabilities, accounts |
| SET | [tenant-settings.md](tenant-settings.md) | Tenant settings and per-account flags |
| SLOT | [timeslot-management.md](timeslot-management.md) | Hosts creating and editing rooms and slots |
| LIFE | [slot-lifecycle.md](slot-lifecycle.md) | Occurrences, lock window, quorum, scheduler |
| MEM | [membership.md](membership.md) | Joining, leaving, one game per hour |
| REQ | [join-requests.md](join-requests.md) | Join policy, approval requests, approve/deny |
| HOST | [slot-hosting.md](slot-hosting.md) | Room owner vs slot host, hosting one week's game |
| RED | [redistribution.md](redistribution.md) | Moving players out of an under-filled slot |
| EVT | [realtime.md](realtime.md) | Socket.IO events |
| API | [api.md](api.md) | Endpoint contract, auth, error shape |
| PROF | [player-profile.md](player-profile.md) | Player details card and its future profile endpoint |
| CARD | [ui/playable-room-card.md](ui/playable-room-card.md) | Player browse card |

Terms used everywhere are defined in [glossary.md](glossary.md). What the
product is for, and what's out of scope, is in [product.md](product.md). New
criteria are judged against it.

Drafting criteria: type `/spec <what you want>` in Claude Code
([.claude/skills/spec](../.claude/skills/spec/SKILL.md)).

## Coverage check

`npm run spec:check` ([scripts/spec-check.mjs](../scripts/spec-check.mjs))
collects every AC id from `specs/**/*.md` and every id that appears in a test
file (`*.test.ts`, `*.spec.ts`). It reports:

- **dangling**: a test cites an id that no spec defines. This fails the check.
- **uncovered**: an AC with no test. This is reported, but doesn't fail the
  check, because most ACs predate the tests.
- **covered gap**: a test cites a `[gap]` AC. That's expected: the test should
  be failing or `it.todo` until the gap is fixed.

## Working with the agents

F, B and Q read these specs. A feature in progress gets its intended behaviour
written here, in the domain spec or a new file, instead of only in
`~/.claude/agents/context/shared.md`. Q tests against the spec: a behaviour that
contradicts an AC is a bug even if the code does exactly what the code says.
