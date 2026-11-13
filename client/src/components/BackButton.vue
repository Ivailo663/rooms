<template>
  <!-- NAV-12: a floating circle, never a bar. The zero-height sticky row keeps
       it at the top left while the page scrolls under it without taking any
       of the page's height. -->
  <div
    class="pointer-events-none sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 h-0"
  >
    <button
      type="button"
      aria-label="Back"
      class="pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-white/85 text-surface-700 shadow-md ring-1 ring-surface-200/70 backdrop-blur transition active:scale-95 active:bg-surface-100 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
      data-back
      @click="goBack"
    >
      <i class="fa-solid fa-arrow-left text-sm" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { hasInAppHistory } from "@/composables/edgeGestures";

const router = useRouter();

// Opened from a shared link there's nothing in the app to go back to, and the
// browser's back would leave the app, so home is the way out.
const goBack = () =>
  hasInAppHistory() ? router.back() : router.push({ name: "home" });
</script>
