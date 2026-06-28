<template>
  <!-- Mobile overlay -->
  <div
    v-if="isMobile && expanded"
    class="fixed inset-0 z-40 bg-black/30"
    @click="emit('update:expanded', false)"
  />

  <!-- Sidebar -->
  <div
    class="shrink-0 transition-all duration-300 ease-in-out"
    :class="sidebarContainerClass"
  >
    <aside
      class="flex flex-col !gap-5 border-surface-200 bg-white transition-all duration-300 overflow-hidden"
      :class="sidebarClass"
    >
      <!-- Header -->
      <div
        class="flex items-center !px-1"
        :class="collapsed ? 'justify-center' : 'justify-between'"
      >
        <div class="flex items-center !gap-2">
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500"
          >
            <i class="fa-solid fa-grip text-white" style="font-size: 0.7rem" />
          </div>
          <span
            v-if="!collapsed"
            class="text-sm font-bold tracking-tight text-surface-900"
          >
            Rooms
          </span>
        </div>
        <Button
          v-if="!collapsed"
          :icon="isMobile ? 'fa-solid fa-xmark' : 'fa-solid fa-chevron-left'"
          severity="secondary"
          text
          size="small"
          @click="emit('update:expanded', false)"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex flex-col !gap-1">
        <router-link
          v-for="item in items"
          :key="item.route"
          :to="item.route"
          class="flex items-center rounded-lg text-sm font-medium text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
          :class="collapsed ? 'justify-center !p-2.5' : '!gap-3 !px-3 !py-2.5'"
          exact-active-class="!bg-primary-50 !text-primary-600"
          @click="isMobile && emit('update:expanded', false)"
        >
          <i
            :class="['w-4 text-center', item.icon]"
            style="font-size: 0.8rem"
          />
          <span v-if="!collapsed">{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="flex-1" />

      <!-- Primary actions -->
      <RoleGate v-if="isHomeRoute" :capability="$cap.rooms.create">
        <div
          class="flex flex-col rounded-xl bg-surface-50 w-full"
          :class="collapsed ? '!gap-1 !p-1.5 items-center' : '!gap-2 !p-2'"
        >
          <Button
            v-if="showCreateButton"
            icon="fa-solid fa-plus"
            :label="collapsed ? undefined : 'Create room'"
            :size="collapsed ? 'small' : undefined"
            :class="collapsed ? '' : 'w-full'"
            @click="createRoomVisible = true"
          />
          <SelectButton
            v-if="!collapsed"
            :model-value="roomView"
            :options="viewOptions"
            :allow-empty="false"
            option-label="label"
            option-value="value"
            fluid
            @update:model-value="(val) => (roomView = val)"
          />
          <Button
            v-else
            v-tooltip.right="roomView === RoomView.Host ? 'Switch to Play' : 'Switch to Host'"
            :icon="roomView === RoomView.Host ? 'fa-solid fa-eye' : 'fa-solid fa-gamepad'"
            size="small"
            variant="outlined"
            class="w-full"
            @click="roomView = roomView === RoomView.Host ? RoomView.Play : RoomView.Host"
          />
        </div>
      </RoleGate>

      <!-- User -->
      <div
        class="flex flex-col border-t border-surface-100 !pt-4 w-full"
        :class="collapsed ? '!gap-1 items-center' : '!gap-2'"
      >
        <div
          v-if="!collapsed"
          class="flex items-center !gap-2 rounded-full border border-surface-200 bg-surface-50 !px-3 !py-1.5"
        >
          <div
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
          >
            <i class="fa-solid fa-user" style="font-size: 0.6rem" />
          </div>
          <span class="truncate text-xs font-medium text-surface-600">
            {{ authStore?.user?.email }}
          </span>
        </div>
        <div v-else class="flex justify-center">
          <div
            class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-600"
          >
            <i class="fa-solid fa-user" style="font-size: 0.6rem" />
          </div>
        </div>
        <Button
          icon="fa-solid fa-right-from-bracket"
          :label="collapsed ? undefined : 'Sign out'"
          severity="secondary"
          text
          size="small"
          :class="collapsed ? '' : 'w-full'"
          @click="handleLogout"
        />
      </div>

      <!-- Collapse toggle (desktop only) -->
      <button
        v-if="!isMobile && !expanded"
        class="flex w-full items-center justify-center rounded-lg !py-1.5 text-surface-400 hover:bg-surface-50 hover:text-surface-600 cursor-pointer border-none outline-none bg-transparent transition-colors"
        @click="emit('update:expanded', true)"
      >
        <i class="fa-solid fa-chevron-right" style="font-size: 0.65rem" />
      </button>
    </aside>
  </div>

  <!-- Mobile hamburger -->
  <Button
    v-if="isMobile && !expanded"
    icon="fa-solid fa-bars"
    severity="secondary"
    text
    class="!fixed !left-4 !top-4 !z-50"
    @click="emit('update:expanded', true)"
  />
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { Button, SelectButton } from "primevue";
import { useAuthStore } from "@/stores/auth";
import { useRoomView } from "@/composables/useRoomView";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { RoomView } from "@/constants";
import { signOut, getAuth } from "firebase/auth";
import RoleGate from "./RoleGate.vue";

const props = defineProps<{ expanded: boolean }>();
const emit = defineEmits<{ "update:expanded": [value: boolean] }>();

const authStore = useAuthStore();
const auth = getAuth();
const router = useRouter();

const roomView = useRoomView();
const createRoomVisible = useCreateRoom();
const showCreateButton = computed(() => roomView.value === RoomView.Host);

const MOBILE_BREAKPOINT = 768;
const isMobile = ref(false);

const checkMobile = () => {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
};

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkMobile);
});

const collapsed = computed(() => !isMobile.value && !props.expanded);

const sidebarContainerClass = computed(() => {
  if (isMobile.value) {
    return props.expanded ? "fixed inset-y-0 left-0 z-50 w-72" : "w-0";
  }
  return props.expanded ? "w-72 !ml-4 !mr-2" : "w-16 !ml-4 !mr-2";
});

const sidebarClass = computed(() => {
  if (isMobile.value) {
    return props.expanded
      ? "h-full w-72 !p-3 opacity-100"
      : "h-full w-0 !p-0 opacity-0 pointer-events-none";
  }
  return [
    "sticky top-4 rounded-xl h-[calc(100vh-2rem)] border",
    props.expanded
      ? "w-72 !p-3 opacity-100"
      : "w-16 !p-2 opacity-100 items-center",
  ];
});

const viewOptions = [
  { label: "Host", value: RoomView.Host },
  { label: "Play", value: RoomView.Play },
];


const items = [
  { label: "Home", icon: "fa-solid fa-house", route: { name: "home" } },
  { label: "Settings", icon: "fa-solid fa-gear", route: { name: "settings" } },
];

const isHomeRoute = computed(() => router.currentRoute.value.name === "home");

const handleLogout = async () => {
  await signOut(auth);
  router.push({ name: "auth" });
};
</script>
