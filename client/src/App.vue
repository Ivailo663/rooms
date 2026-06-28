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
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { ref } from "vue";
import { useAuthStore } from "./stores/auth";
import AppSidebar from "./components/AppSidebar.vue";

const authStore = useAuthStore();
const menuExpanded = ref(true);
</script>

<style scoped></style>
