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
- **SET-06** `/tenants*` requires authentication ([API-01](api.md)) and the
  caller must be that tenant's clientAdmin ([ROLE-05](tenancy-and-roles.md)).
  `[gap]` — these routes are currently **unauthenticated**.
- **SET-07** The `default*` fields are never enforced. A slot's own columns
  win ([SLOT-16](timeslot-management.md)).
- **SET-08** Settings player search lists accounts within the tenant.
  `[deferred]` — it needs a "list accounts in tenant" endpoint, and today it
  searches all accounts ([API-03](api.md)).
