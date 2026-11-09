# Glossary

- **Tenant**: a client pool, such as a sport-complex operator. It owns rooms
  through `Room.tenantid` and carries `tenant.settings` (JSON, see
  [tenant-settings.md](tenant-settings.md)).
- **Room** (UI: *playground*): a venue with weekly timeslots. Its **owner**
  (`creatorId`) runs the schedule ([HOST-01](slot-hosting.md)).
- **Slot host**: a player the owner approved to run one occurrence of a slot.
  They gather their own people and control outsider seats
  ([slot-hosting.md](slot-hosting.md)).
- **Outsider**: on a hosted slot, any joiner the host didn't bring in.
- **Slot** (`RoomTimeslot`): a weekly recurring 60-minute game. It's defined by
  `day` (`mo`…`su`) and `start_time` (minutes from midnight, derived from
  `label` `"HH:MM"`). It carries its own `min_players`, `max_players`, `price`,
  `features` and `message`.
- **Occurrence**: one week's instance of a slot. Roster, join requests and
  status are all scoped to the current occurrence and reset when it ends
  ([LIFE-08](slot-lifecycle.md)).
- **Occurrence window**: `[start_time, start_time + 60)` on the slot's day.
- **Lock window**: `[start_time − cutoff, start_time + 60)` on the slot's day,
  where `cutoff` is the tenant's `lateJoinCutoff` ([LIFE-01](slot-lifecycle.md)).
- **Cutoff verdict**: the scheduler job at `start_time − cutoff` that leaves,
  redistributes or fails a slot.
- **Quorum**: `count > 0 && (min_players === null || count >= min_players)`
  ([LIFE-03](slot-lifecycle.md)).
- **Seat**: a confirmed `TimeslotPlayer` row.
- **Join request**: a `TimeslotJoinRequest` row, `pending` or `denied`. It
  doesn't hold a seat.
- **Clash**: two seats on the same day whose occurrence windows overlap
  (`|Δstart_time| < 60`) ([MEM-20](membership.md)).
- **Sibling slots**: other rooms' slots in the same tenant with the same `day`
  and `start_time`. These are the redistribution targets.
- **Clock**: all occurrence maths uses *local* time: the server process's
  timezone on the server, and the browser's on the client.
