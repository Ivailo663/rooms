<template>
  <div
    class="shrink-0 !overflow-hidden transition-all duration-300 ease-in-out"
    :class="props.visible ? 'w-72 !ml-4 !mr-2' : 'w-0 !ml-0 !mr-0'"
  >
    <aside
      class="sticky rounded-xl top-4 flex h-[calc(100vh-2rem)] w-72 flex-col !gap-5 rounded-lg border border-surface-200 bg-white !p-3 transition-opacity duration-200"
      :class="props.visible ? 'opacity-100' : 'pointer-events-none opacity-0'"
    >
      <!-- Header -->
      <div class="flex items-center justify-between !px-1">
        <div class="flex items-center !gap-2">
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500"
          >
            <i class="fa-solid fa-grip text-white" style="font-size: 0.7rem" />
          </div>
          <span class="text-sm font-bold tracking-tight text-surface-900">
            Rooms
          </span>
        </div>
        <Button
          icon="fa-solid fa-chevron-left"
          severity="secondary"
          text
          size="small"
          @click="emit('update:visible', false)"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex flex-col !gap-1">
        <router-link
          v-for="item in items"
          :key="item.route"
          :to="item.route"
          class="flex items-center !gap-3 rounded-lg !px-3 !py-2.5 text-sm font-medium text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
          active-class="!bg-primary-50 !text-primary-600"
        >
          <i
            :class="['w-4 text-center', item.icon]"
            style="font-size: 0.8rem"
          />
          {{ item.label }}
        </router-link>
      </nav>

      <div class="flex-1" />

      <!-- Primary actions -->
      <RoleGate :capability="$cap.rooms.create">
        <div class="flex flex-col !gap-2 rounded-xl bg-surface-50 !p-2">
          <Button
            v-if="showCreateButton"
            icon="fa-solid fa-plus"
            label="Create room"
            class="w-full"
            @click="createRoomVisible = true"
          />
          <SelectButton
            :model-value="roomView"
            :options="viewOptions"
            :allow-empty="false"
            option-label="label"
            option-value="value"
            fluid
            @update:model-value="(val) => (roomView = val)"
          />
        </div>
      </RoleGate>

      <!-- User -->
      <div class="flex flex-col !gap-2 border-t border-surface-100 !pt-4">
        <div
          class="flex items-center !gap-2 rounded-full border border-surface-200 bg-surface-50 !px-3 !py-1.5"
        >
          <div
            class="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-primary-600"
          >
            <i class="fa-solid fa-user" style="font-size: 0.6rem" />
          </div>
          <span class="truncate text-xs font-medium text-surface-600">
            {{ authStore?.user?.email }}
          </span>
        </div>
        <Button
          icon="fa-solid fa-right-from-bracket"
          label="Sign out"
          severity="secondary"
          text
          size="small"
          class="w-full"
          @click="handleLogout"
        />
      </div>
    </aside>
  </div>
  <Button
    v-if="!props.visible"
    icon="fa-solid fa-bars"
    severity="secondary"
    text
    class="!fixed !left-4 !top-4 !z-50"
    @click="emit('update:visible', true)"
  />
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { computed } from "vue";
import { Button, SelectButton } from "primevue";
import { useAuthStore } from "@/stores/auth";
import { useRoomView } from "@/composables/useRoomView";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { RoomView } from "@/constants";
import { signOut, getAuth } from "firebase/auth";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();

const authStore = useAuthStore();
const auth = getAuth();
const router = useRouter();

const roomView = useRoomView();
const createRoomVisible = useCreateRoom();
const showCreateButton = computed(() => roomView.value === RoomView.Host);

const viewOptions = [
  { label: "Host", value: RoomView.Host },
  { label: "Play", value: RoomView.Play },
];

const items = [
  { label: "Home", icon: "fa-solid fa-house", route: "/" },
  { label: "Settings", icon: "fa-solid fa-gear", route: "/settings" },
];

const handleLogout = async () => {
  await signOut(auth);
  router.push({ name: "root" });
};
</script>
