# API contract

Base URL is `http://localhost:3000`. Request and response shapes are the
TypeScript types in [packages/shared/index.ts](../packages/shared/index.ts).
Those types are the contract, so change them together with this table.

## Cross-cutting

- **API-01** Every endpoint requires `Authorization: Bearer <Firebase ID
  token>`, and a missing one is 401 "No token". `[gap]` — `/tenants*` is not
  behind the auth middleware.
- **API-02** Errors are returned as the HTTP status plus a plain-text message
  body. `[gap]` — `/tenants*` answers JSON `{message}` instead.
- **API-03** `GET /accounts?search=` returns `[]` for a term shorter than 3
  characters. Otherwise it returns up to 100 accounts (`id`, `name`, `email`)
  whose name or email contains the term (case-insensitive), sorted by name,
  never including the caller.
- **API-04** `GET /accounts` is admin-only, or masks emails. `[deferred]` — it
  exposes every account's email to any signed-in user.
- **API-05** Request bodies and params are validated at the boundary. Integer
  params that aren't integers are 400 "`<field>` must be an integer".

## Endpoints

| Method | Path | Who | Success | Spec |
| --- | --- | --- | --- | --- |
| POST | `/user` | any | `Account` | ROLE-07 |
| GET | `/user` | any | `Account \| null` | ROLE-07 |
| GET | `/accounts?search=` | any (should be admin) | `AccountSearchResult[]` | API-03 |
| POST | `/rooms` | host | `CreateRoomResponse` | SLOT-01 |
| GET | `/rooms/hosted?day=` | host | `HostedRoomResponse[]` | SLOT-03 |
| GET | `/rooms/playable?day=` | any | `PlayableRoomResponse[]` | SLOT-04 |
| GET | `/timeslots?room_id&day` | room creator | `TimeslotResponse[]` | SLOT-15, REQ-14 |
| GET | `/timeslots/enabled?room_id&day` | room creator | `TimeslotResponse[]` | SLOT-15, REQ-14 |
| GET | `/timeslots/enabled/days?room_id` | room creator | `EnabledDaySummary[]` | SLOT-15 |
| GET | `/timeslots/pending-days?room_id` | room creator | `string[]` | REQ-16 |
| POST | `/timeslots` | room creator | `CreateTimeslotResponse` | SLOT-10 |
| PUT | `/timeslots` | room creator | `MutationMessageResponse` | SLOT-11 |
| DELETE | `/timeslots/:id` | room creator | `MutationMessageResponse` | SLOT-12 |
| GET | `/timeslots/joined` | any | `JoinedSlotSummary[]` | MEM-30 |
| POST | `/timeslots/:id/join` | any | `JoinTimeslotResponse` | MEM-01..11 |
| POST | `/timeslots/:id/leave` | any | `MutationMessageResponse` | MEM-12..15 |
| POST | `/timeslots/:id/requests/:accountId/approve` | room owner or slot host | `MutationMessageResponse` | REQ-11 |
| POST | `/timeslots/:id/requests/:accountId/deny` | room owner or slot host | `MutationMessageResponse` | REQ-12 |
| DELETE | `/timeslots/:id/requests/:accountId` | room owner or slot host | `MutationMessageResponse` | REQ-13 |
| POST | `/timeslots/:id/redistribute` | room owner (gap) | `MutationMessageResponse` | RED-08 |
| GET | `/tenants/:tenantId` | tenant clientAdmin (gap) | `TenantSettingsResponse` | SET-02 |
| POST | `/tenants` | tenant clientAdmin (gap) | `{message}` | SET-03 |
| POST | `/tenants/accounts` | tenant clientAdmin (gap) | `{message}` | SET-04 |

## Not yet

- **Player profiles:** an endpoint for the details card's data. Its shape is
  open ([player-profile.md](player-profile.md), question 1).

The types are compile-time only, and nothing validates a body at runtime. The
natural next step is a zod schema per request type in `packages/shared`,
parsed in each route. Not done yet, so that this change doesn't touch
behaviour.
