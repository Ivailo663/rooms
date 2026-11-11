# Tenancy and roles

Code: [server/prisma/schema.prisma](../server/prisma/schema.prisma),
[client/src/stores/role.ts](../client/src/stores/role.ts),
[server/routes/users.ts](../server/routes/users.ts).

- **ROLE-01** The roles are `player`, `clientAdmin` and `superAdmin`. The
  hierarchy is cumulative, `player < clientAdmin < superAdmin`: each role has
  every capability of the roles below it. Owning a room and hosting a slot are
  not roles. A room's owner is its `creatorId` ([HOST-01](slot-hosting.md)), and
  a slot's host is stored on the slot ([HOST-02](slot-hosting.md)). There is no
  `host` role.
- **ROLE-02** Capabilities by the role that first grants them:
  - player: `rooms.view`, `rooms.join`, `timeslots.join`, `timeslots.leave`,
    asking to host a slot (HOST-10)
  - clientAdmin: `rooms.create|edit|delete`,
    `timeslots.create|edit|delete|toggle`, `admin.dashboard`,
    `admin.manageUsers`, `admin.manageRooms`
  - superAdmin: `admin.systemSettings`, `admin.assignRoles`
- **ROLE-03** A player is tenant-independent (`accounts.tenantid` is null). A
  player browses and joins rooms of every tenant.
- **ROLE-04** A clientAdmin is bound to one tenant by `accounts.tenantid`. That
  column is the ownership link and stays.
- **ROLE-05** A clientAdmin can read and edit only their own tenant's settings
  and flags ([SET-09, SET-10](tenant-settings.md)). A superAdmin can manage
  any tenant.
- **ROLE-06** The server enforces ROLE-02 capabilities on every mutating
  endpoint, from the caller's account role and the ROLE-01 hierarchy. A caller
  whose role lacks the capability gets 403 "Your role can't do this", and
  nothing changes. The role check comes before any ownership check.
  ROLE-10..12 list what each endpoint needs.
- **ROLE-07** On first sign-in, `POST /user` creates the account by email, with
  `name` set to the email's local part and `role: player`. Later calls return
  the existing account unchanged.
- **ROLE-08** A superAdmin manages tenants as entities (plan, owners,
  playgrounds). `[deferred]` — none of this is modelled yet.

## What each mutating endpoint needs

- **ROLE-10** `POST /rooms` needs `rooms.create`: clientAdmin or above. A
  player gets 403 (ROLE-06).
- **ROLE-11** Changing a room's slots (`POST`, `PUT` and `DELETE /timeslots`,
  including enabling and disabling), redistributing
  ([RED-08](redistribution.md)), and answering join requests as the room's
  owner ([REQ-10](join-requests.md)) need clientAdmin or above **and** owning
  the room. The role check runs first (403); the ownership answers stay as
  they are (404 for slots, 403 for the others).
- **ROLE-12** These need no role beyond being signed in: `POST /user`,
  joining and leaving a slot, and answering join requests as the slot's host
  ([REQ-10](join-requests.md)).

## Changing roles

- **ROLE-13** A tenant always has at least one clientAdmin. Demoting its last
  clientAdmin is refused (409), and nothing changes. `[deferred]` — no endpoint
  changes roles yet.
- **ROLE-14** When a clientAdmin is demoted, every room they own is handed over
  to another clientAdmin of the same tenant, in the same step. Rooms are never
  left without an owner who can manage them (ROLE-11). `[deferred]` — no
  endpoint changes roles yet.

## Open questions

1. **Who takes the rooms (ROLE-14)?** When the tenant has several other
   clientAdmins, which one gets the demoted admin's rooms: one picked by the
   person doing the demotion, or a fixed rule (for example, the longest-serving
   admin)?
