# Redistribution

Code: [server/redistribution.ts](../server/redistribution.ts). It's triggered by
the cutoff verdict ([LIFE-05](slot-lifecycle.md)) or manually through
`POST /timeslots/:id/redistribute`.

- **RED-01** Redistribution runs only for a slot that is enabled, `scheduled`,
  has `min_players` set, and has `1 ≤ count < min_players`. Anything else is a
  no-op (`not-redistributed`).
- **RED-02** Candidates are the other slots that are enabled, `scheduled`, on
  the same `day` with the same `start_time`, in rooms of the **same tenant**,
  and have at least one open seat (`max_players − count > 0`).
- **RED-03** A player is never placed in a candidate where they already hold a
  seat, or where they have a **denied** request this occurrence.
- **RED-04** It's all or nothing. If the candidates' total open seats are fewer
  than the players, or any single player can't be placed under RED-03, nothing
  changes.
- **RED-05** Players are taken in random order, and each goes to the first
  candidate that still has an open seat and is allowed for them. The candidate
  order isn't defined (there's no `orderBy`), and the shuffle is the biased
  `sort(() => Math.random() − 0.5)`.
- **RED-06** On success, in one serializable transaction: the source roster is
  deleted, the source status becomes `redistributed`, and every player is
  seated at their destination.
- **RED-07** On success, these are emitted: `timeslot-membership:changed` for
  the source and every destination, `timeslot-redistributed` (source, room,
  destinations with player counts), and `timeslot-status:changed {status:
  "redistributed"}`.
- **RED-08** The manual endpoint is restricted to the room's owner
  ([HOST-01](slot-hosting.md)). `[gap]` — today any authenticated user can
  trigger it.

- **RED-09** Redistribution doesn't apply the join policy (REQ-01..04). The
  policy belongs to the tenant, and that same tenant admitted the player and
  turned on `autoRedistribute`, so a player who would need approval can still
  be seated in a sibling. Denials still hold (RED-03).

## Open questions

- For an untenanted room, the manual endpoint treats "same tenant" as "all
  untenanted rooms".
