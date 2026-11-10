# Membership: join and leave

Code: [server/routes/membership.ts](../server/routes/membership.ts); client
mirror `client/src/features/rooms/composables/slotJoinability.ts`.

## Joining: `POST /timeslots/:id/join`

The gates are checked in this order. The first gate that applies decides the
response. The client's `getSlotJoinability` returns its block reason in the same
order, so the button label matches the error a click would get.

- **MEM-01** If the slot doesn't exist: 404 "Timeslot not found".
- **MEM-02** If the caller already holds a seat: 200 `{status: "already"}`, no
  change. This comes before every other gate.
- **MEM-03** (mirrored: `no-game`) If the slot's status is `failed`,
  `redistributed` or `ended`: 409 "This game is closed".
- **MEM-04** (mirrored: `live`) If the status is `live`: 409 "This game has
  already started", unless the tenant's `allowJoinOnLive` is true. In that case
  the join continues to the next gates. The lock window doesn't apply to a live
  slot.
- **MEM-05** (mirrored: `closed`) If the slot is `scheduled` and inside the
  lock window ([LIFE-01](slot-lifecycle.md)): 409 "Joining has closed for this
  game".
- **MEM-06** (mirrored: `clash`) If the caller holds a clashing seat (MEM-20):
  409 "You're already in the {label} game at {room}". This is checked
  **before** the join policy, so a clash also blocks raising a join request.
- **MEM-07** Next comes the tenant join policy ([join-requests.md](join-requests.md)).
  It may answer `pending` or `denied` here, and in that case no seat is taken.
- **MEM-08** (mirrored: `full`) If `seats ≥ max_players`: 409 "Timeslot is full".
  On a hosted slot, an outsider who finds the host's outsider seats used up
  gets 409 "The host has closed this game" ([HOST-21](slot-hosting.md)).
- **MEM-09** Otherwise a seat is created: 200 `{status: "joined"}`. Then
  `timeslot-membership:changed` is emitted, and
  `join-request:validity-changed {valid: false}` is emitted for the caller's
  pending requests in clashing slots.
- **MEM-10** A disabled slot can't be joined or requested. It answers 404
  "Timeslot not found", like a missing one, and nothing is created.
- **MEM-11** The join runs in a serializable transaction, so two concurrent
  joins can't both take the last seat.

## Leaving: `POST /timeslots/:id/leave`

- **MEM-12** (mirrored) Inside the lock window: 409 "Leaving has closed for this
  game". This holds through the cutoff verdict, the game, and a "no game"
  outcome alike.
- **MEM-13** Outside it, the caller's seat and their **pending** request for
  that slot are deleted. A **denied** request is kept, so leave-and-rejoin
  can't wipe a denial.
- **MEM-14** Leaving a slot you're not in returns 200 and changes nothing.
- **MEM-15** When a seat was actually removed, `timeslot-membership:changed` is
  emitted, and `join-request:validity-changed {valid: true}` is emitted for the
  caller's pending requests in clashing slots.

## One game per hour

- **MEM-20** (mirrored) Two seats clash when both slots are enabled, fall on
  the same `day`, and `|start_time₁ − start_time₂| < 60`. Room and tenant don't
  matter, because the player's own calendar is what's being protected.
- **MEM-21** Only seats clash. A pending request is not a commitment, so a
  player may have requests pending in several slots in the same hour.
  Whichever is approved first wins ([REQ-11](join-requests.md)).

## My games: `GET /timeslots/joined`

- **MEM-30** Returns every enabled slot where the caller holds a seat or a
  **pending** request, or which they host, across all rooms and days, with the
  full roster. `membership` is `hosting` if the caller hosts the slot
  ([HOST-34](slot-hosting.md)), else `joined` if they hold a seat, else
  `pending`.
- **MEM-31** The list is ordered Monday→Sunday, then by `start_time`. The
  client re-sorts it relative to now.
- **MEM-32** Each entry carries the effective `lateJoinCutoff`
  ([LIFE-02](slot-lifecycle.md)), so the client can compute leavability.
