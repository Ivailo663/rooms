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

  <div v-else class="flex min-h-screen">
    <AppSidebar v-if="authStore.user" v-model:visible="menuVisible" />

    <!-- Main content -->
    <div class="flex-1 height-[100dvh] overflow-y-auto">
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { ref } from "vue";
import { useAuthStore } from "./stores/auth";
import AppSidebar from "./components/AppSidebar.vue";

const authStore = useAuthStore();
const menuVisible = ref(true);
</script>

<style scoped></style>
