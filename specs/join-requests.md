# Join policy and approval requests

Code: [server/routes/membership.ts](../server/routes/membership.ts),
[server/routes/timeslots.ts](../server/routes/timeslots.ts) (`findInvalidRequests`),
[server/routes/rooms.ts](../server/routes/rooms.ts) (`pendingRequestCount`).

## Policy (step MEM-07 of the join)

These rules apply only to rooms with a `tenantid`. In an untenanted room every
join is direct.

- **REQ-01** `joinMode: "free"`, or unset: the join is direct.
- **REQ-02** `joinMode: "required"`: every join becomes a request.
- **REQ-03** `joinMode: "required-list"`: the join becomes a request when the
  caller's `TenantAccount` row has `requiresApproval`.
- **REQ-04** A `blacklisted` caller is refused with 403 "You can't join games
  at this venue", in **every** join mode. If the tenant's `includeBlacklisted`
  is true, the join becomes a request instead (as REQ-02). This is checked
  before REQ-01..03. `[tbd]` — see "To be discussed: blacklist" below. Until
  that's settled, the code keeps today's behaviour: the blacklist only matters
  under `required-list` with `includeBlacklisted` on.
- **REQ-05** Raising a request is idempotent. There's one row per
  (slot, account), and clicking Join again answers `pending` again.
- **REQ-06** A pending request doesn't reserve a seat. Capacity is checked
  only when the request is approved.
- **REQ-07** If the caller already has a **denied** request for this
  occurrence, the answer is 200 `{status: "denied"}` with the tenant's trimmed
  `deniedMessage`, or "Your request was not accepted for this slot" when that's
  empty. No new request is raised.
- **REQ-08** A new request emits `join-request:created`. The answer is 200
  `{status: "pending"}`.

## Host actions

- **REQ-10** Approving, denying and dismissing are allowed only for the room's
  owner ([HOST-01](slot-hosting.md)) or the slot's current host
  ([HOST-24](slot-hosting.md)). Anyone else gets 403 "You do not manage this
  room". An unknown slot gets 404.
- **REQ-11** Approve (`POST /timeslots/:id/requests/:accountId/approve`): if
  there's no request, 404. If the player now holds a clashing seat, 409. If
  the slot is full, 409. Otherwise, in one serializable transaction, a seat is
  created and the request is deleted. Then `timeslot-membership:changed` and
  `join-request:resolved {approved: true}` are emitted, plus validity-changed
  `{valid: false}` for the player's other clashing requests.
- **REQ-12** Deny (`POST …/deny`): a **pending** request becomes `denied` with
  `resolved_at` set, and `join-request:resolved {approved: false}` is emitted.
  The denial lasts until the occurrence ends ([LIFE-08](slot-lifecycle.md)).
- **REQ-13** Dismiss (`DELETE /timeslots/:id/requests/:accountId`) is allowed
  only while the request is invalid, meaning the player holds a clashing seat.
  Otherwise the answer is 409 "This request is still open — approve or decline
  it". The row is deleted, not denied, so no denial follows the player.

## What the host sees

- **REQ-14** The host's slot lists (`GET /timeslots`, `/timeslots/enabled`)
  return each pending request with `valid: false` when the requester holds a
  clashing seat in another slot.
- **REQ-15** `GET /rooms/hosted` returns `pendingRequestCount` per room, counted
  from the DB. A missed socket event corrects itself on reload.
- **REQ-16** `GET /timeslots/pending-days?room_id=` returns the weekdays of
  that room that have at least one pending request.

## Cleanup

- **REQ-20** A slot failing drops its pending requests ([LIFE-06](slot-lifecycle.md)).
  A player leaving drops their own pending request ([MEM-13](membership.md)).
  The end of an occurrence drops all of them ([LIFE-08](slot-lifecycle.md)).
- **REQ-21** Stale pending requests expire when the slot starts, or at
  `lateJoinCutoff`. `[deferred]` — until then they linger until resolved, left,
  or reset at the end of the occurrence.
- **REQ-22** The host has one global inbox or bell for pending requests across
  rooms. `[deferred]` — today there's only the per-card pill.

## To be discussed: blacklist

Status: `[tbd]`. The criteria that depend on it are REQ-04, HOST-17, HOST-28
and the `includeBlacklisted` setting. **Today's code stays as it is until this
is settled. Don't build these.**

**Agreed so far:** a blacklisted person broke the venue's rules or terms. They
can't host.

**To refine:**
1. **What it does.** Is a blacklisted person banned outright, sent through
   approval, or hidden from the venue's rooms altogether?
2. **Scope.** The whole tenant (today's `TenantAccount`), or one room?
3. **Who sets it.** Only the tenant's clientAdmin, or room owners too?
4. **Duration.** Permanent until lifted, or timed (for example 30 days)? Is a
   reason recorded?
5. **What the player sees.** A clear "you can't join this venue", or a generic
   refusal?
6. **Existing seats.** If someone is blacklisted while they hold a seat this
   week, are they removed?
7. **`includeBlacklisted`.** Keep it, rename it, or drop it once (1) is
   decided?
