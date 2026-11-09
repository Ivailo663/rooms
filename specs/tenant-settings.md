# Tenant settings and account flags

Code: [server/routes/tenants.ts](../server/routes/tenants.ts),
[client/src/views/SettingsView.vue](../client/src/views/SettingsView.vue),
`TenantSettings` in [packages/shared/index.ts](../packages/shared/index.ts).

## Settings (`tenant.settings` JSON)

| Field | Default when unset | Enforced by |
| --- | --- | --- |
| `joinMode` | `"free"` | [REQ-01..03](join-requests.md) |
| `includeBlacklisted` | `false` | [REQ-04](join-requests.md) `[tbd]`: blacklist under discussion |
| `hostStepDownCutoff` | `120` (minutes before the lock window) | [HOST-18](slot-hosting.md) |
| `lateJoinCutoff` | `15` | [LIFE-01, LIFE-02](slot-lifecycle.md) |
| `allowJoinOnLive` | `false` | [MEM-04](membership.md) |
| `autoRedistribute` | `false` | [LIFE-05](slot-lifecycle.md) |
| `deniedMessage` | generic text | [REQ-07](join-requests.md) |
| `defaultMaxPlayers`, `defaultMinPlayers`, `defaultPrice`, `defaultFeatures` | — | form pre-fill only |

- **SET-01** Every setting is tenant-wide. Missing or invalid values fall back
  to the defaults above, and the server never fails because of a missing key.
- **SET-02** `GET /tenants/:tenantId` returns `{id, name, settings,
  flaggedAccounts}`. `flaggedAccounts` holds only accounts with at least one
  flag set. An unknown tenant is 404.
- **SET-03** `POST /tenants {tenantId, settings}` replaces the settings and
  re-syncs the tenant's slot jobs ([LIFE-11](slot-lifecycle.md)). A missing
  field is 400.
- **SET-04** `POST /tenants/accounts {tenantId, accountId, requiresApproval?,
  blacklisted?}` sets the flags. An omitted flag keeps its current value.
- **SET-05** When both flags end up false, the `TenantAccount` row is deleted
  rather than kept empty.
- **SET-06** Every `/tenants*` request without a valid Firebase token is
  answered 401 "No token" ([API-01](api.md)).
- **SET-09** A caller may read or change a tenant only if they are a
  `clientAdmin` whose `accounts.tenantid` is that tenant, or a `superAdmin`.
  Anyone else gets 403 "You do not manage this venue", and nothing changes.
  The tenant is `:tenantId` for the GET, and the body's `tenantId` for the two
  POSTs. An unknown tenant is 403 for a clientAdmin, and only a superAdmin can
  get its 404. ([ROLE-05](tenancy-and-roles.md))
- **SET-10** (mirrored) Settings exists only for callers SET-09 lets in: a
  `clientAdmin` with a `tenantid`, or a `superAdmin`. Anyone else doesn't see
  the Settings entry in the sidebar, and opening `/settings` directly sends
  them home.
- **SET-11** The Settings page loads and saves the caller's own tenant
  (`accounts.tenantid` from `/user`), never a hardcoded id. Nothing shows while
  the account or the settings are loading. If the server still answers 403, or
  a superAdmin has no tenant, the page says "You don't manage a venue".
- **SET-07** The `default*` fields are never enforced. A slot's own columns
  win ([SLOT-16](timeslot-management.md)).
- **SET-08** Settings player search lists accounts within the tenant.
  `[deferred]` — it needs a "list accounts in tenant" endpoint, and today it
  searches all accounts ([API-03](api.md)).
