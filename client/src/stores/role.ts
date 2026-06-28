import { defineStore, storeToRefs } from "pinia";
import { computed } from "vue";
import { useAuthStore } from "./auth";
import type { AccountRole } from "@football/shared";

export const Cap = {
  rooms: {
    view: "rooms.view",
    join: "rooms.join",
    create: "rooms.create",
    edit: "rooms.edit",
    delete: "rooms.delete",
  },
  timeslots: {
    join: "timeslots.join",
    leave: "timeslots.leave",
    create: "timeslots.create",
    edit: "timeslots.edit",
    delete: "timeslots.delete",
    toggle: "timeslots.toggle",
  },
  admin: {
    dashboard: "admin.dashboard",
    manageUsers: "admin.manageUsers",
    manageRooms: "admin.manageRooms",
    systemSettings: "admin.systemSettings",
    assignRoles: "admin.assignRoles",
  },
} as const;

type CapValue<T> = T extends Record<string, infer V>
  ? V extends string
    ? V
    : CapValue<V>
  : never;

export type Capability = CapValue<typeof Cap>;

const roleCapabilities: Record<AccountRole, readonly Capability[]> = {
  player: [
    Cap.rooms.view,
    Cap.rooms.join,
    Cap.timeslots.join,
    Cap.timeslots.leave,
  ],
  host: [
    Cap.rooms.create,
    Cap.rooms.edit,
    Cap.rooms.delete,
    Cap.timeslots.create,
    Cap.timeslots.edit,
    Cap.timeslots.delete,
    Cap.timeslots.toggle,
  ],
  clientAdmin: [
    Cap.admin.dashboard,
    Cap.admin.manageUsers,
    Cap.admin.manageRooms,
  ],
  superAdmin: [
    Cap.admin.systemSettings,
    Cap.admin.assignRoles,
  ],
};

const roleHierarchy: AccountRole[] = [
  "player",
  "host",
  "clientAdmin",
  "superAdmin",
];

function getCapabilitiesForRole(role: AccountRole): Set<Capability> {
  const rank = roleHierarchy.indexOf(role);
  const result = new Set<Capability>();

  for (let i = 0; i <= rank; i++) {
    for (const cap of roleCapabilities[roleHierarchy[i]!]!) {
      result.add(cap);
    }
  }

  return result;
}

export const useRoleStore = defineStore("role", () => {
  const authStore = useAuthStore();
  const { user } = storeToRefs(authStore);

  const role = computed<AccountRole | null>(
    () => (user.value as { role?: AccountRole } | null)?.role ?? null,
  );

  const allowedCapabilities = computed(() =>
    role.value ? getCapabilitiesForRole(role.value) : new Set<Capability>(),
  );

  const can = (capability: Capability) =>
    allowedCapabilities.value.has(capability);

  const isPlayer = computed(() => role.value === "player");
  const isHost = computed(() => role.value === "host");
  const isClientAdmin = computed(() => role.value === "clientAdmin");
  const isSuperAdmin = computed(() => role.value === "superAdmin");

  return { role, can, isPlayer, isHost, isClientAdmin, isSuperAdmin };
});
