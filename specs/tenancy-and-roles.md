# Tenancy and roles

Code: [server/prisma/schema.prisma](../server/prisma/schema.prisma),
[client/src/stores/role.ts](../client/src/stores/role.ts),
[server/routes/users.ts](../server/routes/users.ts).

- **ROLE-01** The roles are `player`, `owner`, `clientAdmin` and `superAdmin`.
  The hierarchy is cumulative, `player < owner < clientAdmin < superAdmin`: each
  role has every capability of the roles below it. (`owner` was called `host`.
  Hosting a slot is not a role, and any player may ask to host
  ([slot-hosting.md](slot-hosting.md)).)
- **ROLE-02** Capabilities by the role that first grants them:
  - player: `rooms.view`, `rooms.join`, `timeslots.join`, `timeslots.leave`,
    asking to host a slot (HOST-10)
  - owner: `rooms.create|edit|delete`, `timeslots.create|edit|delete|toggle`
  - clientAdmin: `admin.dashboard`, `admin.manageUsers`, `admin.manageRooms`
  - superAdmin: `admin.systemSettings`, `admin.assignRoles`
- **ROLE-03** A player is tenant-independent (`accounts.tenantid` is null). A
  player browses and joins rooms of every tenant.
- **ROLE-04** A clientAdmin (and a host) is bound to one tenant by
  `accounts.tenantid`. That column is the ownership link and stays.
- **ROLE-05** A clientAdmin can read and edit only their own tenant's settings
  and flags. `[gap]` — the server doesn't check this, and the client hardcodes
  `tenantId = 1`.
- **ROLE-06** The server enforces ROLE-02 capabilities on every mutating
  endpoint. `[gap]` — roles are only checked in the client (`RoleGate`).
  Today the server checks room ownership where noted, and nothing else.
- **ROLE-07** On first sign-in, `POST /user` creates the account by email, with
  `name` set to the email's local part and `role: player`. Later calls return
  the existing account unchanged.
- **ROLE-08** A superAdmin manages tenants as entities (plan, owners,
  playgrounds). `[deferred]` — none of this is modelled yet.
