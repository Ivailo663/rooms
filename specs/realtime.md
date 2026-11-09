# Realtime events (Socket.IO)

Payload types live in [packages/shared/index.ts](../packages/shared/index.ts).

| Event | Payload | Emitted by |
| --- | --- | --- |
| `timeslot-membership:changed` | `TimeslotMembershipChangedPayload` | join, leave, approve, redistribution, end reset |
| `timeslot-status:changed` | `TimeslotStatusChangedPayload` | every status transition |
| `timeslot-redistributed` | `TimeslotRedistributedPayload` | successful redistribution |
| `join-request:created` | `JoinRequestCreatedPayload` | request raised |
| `join-request:resolved` | `JoinRequestResolvedPayload` | approve, deny, dismiss |
| `join-request:validity-changed` | `JoinRequestValidityChangedPayload` | a seat taken or freed that clashes with pending requests |

- **EVT-01** Events are hints. The client invalidates or patches its queries
  from them, and the DB stays the source of truth. A missed event must
  correct itself on the next fetch or reload.
- **EVT-02** Every event above is emitted after its DB transaction commits,
  never from inside it.
- **EVT-03** Events are broadcast to every connected client (`io.emit`), and
  the client filters for relevance.
- **EVT-04** Join-request events go only to the room's host, and membership
  events only to clients that are viewing that slot. `[deferred]`
