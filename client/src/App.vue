<template>
  <div
    v-if="!authStore.initialized"
    class="flex min-h-screen items-center justify-center bg-surface-50"
  >
    <div class="flex items-center !gap-3 text-surface-400">
      <i class="fa-solid fa-spinner fa-spin text-xl" />
      <span class="text-sm font-medium">Loading…</span>
    </div>
  </div>

  <template v-else>
    <header
      v-if="authStore.initialized && authStore.user"
      class="sticky top-0 z-50 border-b border-surface-200 bg-white/90 backdrop-blur-sm"
    >
      <div class="!mx-auto grid h-14 grid-cols-3 items-center !px-6">
        <!-- Brand + nav -->
        <div class="flex items-center !gap-8">
          <div class="flex items-center !gap-2">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500"
            >
              <i
                class="fa-solid fa-grip text-white"
                style="font-size: 0.7rem"
              />
            </div>
            <span class="text-sm font-bold tracking-tight text-surface-900">
              Rooms
            </span>
          </div>

          <nav class="flex items-center !gap-0.5">
            <router-link
              v-for="item in items"
              :key="item.route"
              :to="item.route"
              class="flex items-center !gap-1.5 rounded-lg !px-3 !py-2 text-sm font-medium text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
              active-class="!text-primary-600 !bg-primary-50"
            >
              <i :class="item.icon" style="font-size: 0.75rem" />
              {{ item.label }}
            </router-link>
          </nav>
        </div>

        <!-- Center: view toggle -->
        <div class="flex justify-center">
          <SelectButton
            :model-value="roomView"
            :options="viewOptions"
            :allow-empty="false"
            option-label="label"
            option-value="value"
            @update:model-value="(val) => (roomView = val)"
          />
        </div>

        <!-- User area -->
        <div class="flex items-center justify-end !gap-2">
          <Button
            v-if="showCreateButton"
            icon="fa-solid fa-plus"
            label="Create room"
            size="small"
            @click="createRoomVisible = true"
          />
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
            @click="handleLogout"
          />
        </div>
      </div>
    </header>

    <RouterView />
  </template>
</template>

<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from "vue-router";
import { ref, computed } from "vue";
import { Button, SelectButton } from "primevue";
import { useAuthStore } from "./stores/auth";
import { useRoomView } from "./composables/useRoomView";
import { useCreateRoom } from "./composables/useCreateRoom";
import { signOut, getAuth } from "firebase/auth";

const authStore = useAuthStore();
const auth = getAuth();
const router = useRouter();

const roomView = useRoomView();
const createRoomVisible = useCreateRoom();
const showCreateButton = computed(() => roomView.value === "hosted");

const viewOptions = [
  { label: "Host", value: "hosted" },
  { label: "Play", value: "others" },
];

const items = ref([
  {
    label: "Home",
    icon: "fa-solid fa-house",
    route: "/",
  },
  {
    label: "About",
    icon: "fa-solid fa-circle-info",
    route: "/about",
  },
]);

const handleLogout = async () => {
  await signOut(auth);
  router.push({ name: "root" });
};
</script>

<style scoped></style>
