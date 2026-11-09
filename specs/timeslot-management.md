# Rooms and slot management (host)

Code: [server/routes/timeslots.ts](../server/routes/timeslots.ts),
[server/routes/rooms.ts](../server/routes/rooms.ts).

## Rooms

- **SLOT-01** `POST /rooms` creates a room with `name`, `description` and
  `price` (`address` is empty). The caller becomes its owner
  ([HOST-01](slot-hosting.md)).
- **SLOT-02** The room's owner is the authenticated caller, not a body field.
  `[gap]` — `creator_id` and `host_id` are taken from the request body.
- **SLOT-03** `GET /rooms/hosted` lists the rooms the caller **owns**
  (`creatorId`). Each carries `pendingRequestCount` ([REQ-15](join-requests.md))
  and the first currently `live` enabled slot, if there is one (optionally
  filtered by `?day=`).
- **SLOT-04** `GET /rooms/playable` lists every room the caller does **not**
  own, from every tenant, with its enabled slots (optionally filtered by
  `?day=`) ordered by `order`. Each room carries the effective `lateJoinCutoff`,
  `allowJoinOnLive` and `deniedMessage`. Each slot carries its roster and the
  caller's `requestStatusForCurrentUser`.

## Slots

- **SLOT-10** `POST /timeslots` creates a slot in a room the caller created.
  Otherwise the answer is 404. `start_time` is derived from `label` (`"HH:MM"`
  → minutes). `enabled` defaults to false.
- **SLOT-11** `PUT /timeslots` updates only the fields present in the body.
  Changing `label` recomputes `start_time` and sets `order` to the hour.
- **SLOT-12** `DELETE /timeslots/:id` deletes a slot in a room the caller
  created. Otherwise the answer is 404. Roster and requests cascade.
- **SLOT-13** Every create, update and delete re-syncs the slot's scheduler jobs
  ([LIFE-09](slot-lifecycle.md)).
- **SLOT-14** A room can't have two slots with the same (`day`, `label`).
- **SLOT-15** `GET /timeslots`, `/timeslots/enabled` (which excludes `ended`)
  and `/timeslots/enabled/days` only return slots of rooms the caller created.
  `day` is required where it applies, and a missing `day` is 400 "day is
  required", never "all days".
- **SLOT-16** `min_players`, `max_players`, `price`, `features` and `message`
  are enforced from the slot's own columns. The tenant's `default*` settings
  only pre-fill the form ([SET-07](tenant-settings.md)).
- **SLOT-17** `1 ≤ min_players ≤ max_players` is validated on create and
  update, with 400 on violation. `[gap]` — not validated today.
