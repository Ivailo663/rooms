# Slot lifecycle

Code: [server/scheduler.ts](../server/scheduler.ts),
[server/workers/timeslotWorker.ts](../server/workers/timeslotWorker.ts),
[server/slotRules.ts](../server/slotRules.ts); client mirrors in
`client/src/features/rooms/composables/` (`slotQuorum.ts`,
`slotJoinability.ts`, `isSlotLiveNow.ts`).

## Statuses

`scheduled → live → (reset) scheduled`
`scheduled → failed | redistributed → (reset) scheduled`

`ended` exists in the enum, but no code path sets it. The end-of-occurrence
reset goes straight back to `scheduled`.

## Rules

- **LIFE-01** (mirrored) The lock window is `[start_time − cutoff, start_time + 60)`
  minutes, on the slot's own weekday, by local clock. It's derived from the
  clock, not from `status`, so a stale status can never lock a roster forever.
- **LIFE-02** (mirrored) `cutoff` is the tenant's `lateJoinCutoff` when it's a
  number > 0. Otherwise (unset, 0, negative, not a number, or an untenanted
  room) it's **15**.
- **LIFE-03** (mirrored) A slot has quorum when `count > 0` and either
  `min_players` is null or `count ≥ min_players`. With no minimum, that means
  "somebody joined".
- **LIFE-04** Cutoff verdict: at `start_time − cutoff`, a `scheduled` slot with
  quorum is left unchanged.
- **LIFE-05** Cutoff verdict: a `scheduled` slot below quorum, with ≥ 1 player,
  in a tenant with `autoRedistribute: true`, is offered to redistribution
  ([redistribution.md](redistribution.md)), unless the slot is hosted
  ([HOST-15](slot-hosting.md)). If redistribution succeeds the slot
  ends `redistributed`. If it doesn't, LIFE-06 applies.
- **LIFE-06** Cutoff verdict: any other `scheduled` slot below quorum becomes
  `failed`. Its **pending** join requests are deleted in the same transaction.
  **Denied** requests are kept.
- **LIFE-07** Go-live: at `start_time`, a `scheduled` slot with quorum becomes
  `live`. A `scheduled` slot below quorum becomes `failed` (as LIFE-06). This
  re-check exists because the cutoff job may not have run. A slot in any
  other status is untouched.
- **LIFE-08** End: at `start_time + 60`, a slot in `live`, `failed` or
  `redistributed` returns to `scheduled`. In one transaction, its roster,
  **all** of its join requests (pending and denied), and its host and host
  requests ([HOST-14](slot-hosting.md)) are deleted.
- **LIFE-09** A disabled slot has no scheduler jobs, and the worker ignores
  jobs for it. Creating, updating, enabling, disabling or deleting a slot
  re-syncs its jobs.
- **LIFE-10** On startup and every 60 s, the server reconciles every enabled
  slot against the clock. A slot that's `live` outside its occurrence window
  gets an end job. A slot that's not `live` inside its window gets a go-live
  job, and go-live re-checks quorum. Running it repeatedly is safe.
- **LIFE-11** Saving a tenant's settings re-syncs the jobs of all its enabled
  slots, so a changed `lateJoinCutoff` moves the cutoff verdict.
- **LIFE-12** Every status transition emits `timeslot-status:changed`
  ([realtime.md](realtime.md)).
- **LIFE-13** (client) A slot is presented as live, or as failed, only while the
  clock is inside its occurrence window. Outside the window, a leftover
  `live`/`failed` status is shown as scheduled.

## Known limitations

- Occurrence and lock windows that cross midnight aren't handled. Hosts can
  only pick 17:00–22:00 starts today (`TIME_SLOTS`), so this can't happen yet.
- The server and the client each use their own local timezone. If they ever
  differ, the UI's lock and live predictions will be off.
