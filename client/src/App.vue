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

  <div v-else class="flex min-h-screen bg-gradient-to-b from-slate-50 via-sky-50/40 to-emerald-50/30">
    <AppSidebar v-if="authStore.user" v-model:expanded="menuExpanded" />

    <!-- Main content -->
    <div class="flex-1 h-[100dvh] overflow-y-auto !p-4">
      <RouterView />
    </div>
  </div>

  <ConfirmDialog
    :closable="false"
    :pt="{
      root: {
        class: '!rounded-2xl !border !border-surface-100 !shadow-lg !max-w-sm',
      },
      header: { class: '!px-5 !pt-5 !pb-0 !border-none' },
      title: { class: '!text-base !font-semibold !text-surface-900' },
      content: { class: '!px-5 !py-3' },
      message: { class: '!text-sm !leading-relaxed !text-surface-500' },
      footer: {
        class:
          '!px-5 !pb-5 !pt-3 !border-none !gap-2 flex !justify-end',
      },
    }"
  />
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { ref, watch } from "vue";
import ConfirmDialog from "primevue/confirmdialog";
import { useAuthStore } from "./stores/auth";
import AppSidebar from "./components/AppSidebar.vue";
import { useJoinRequestSync } from "./features/rooms/composables/useJoinRequestSync";
import { useRoomView } from "./composables/useRoomView";
import { RoomView } from "./constants";

const authStore = useAuthStore();

// Play mode is a focused, "in the game" surface — start with the sidebar
// collapsed there and expanded in Host. Manual toggles still stick until the
// view changes again.
const roomView = useRoomView();
const menuExpanded = ref(roomView.value !== RoomView.Play);

watch(roomView, (view) => {
  menuExpanded.value = view !== RoomView.Play;
});

// App-wide realtime sync for join-request events.
useJoinRequestSync();
</script>

<style scoped></style>
