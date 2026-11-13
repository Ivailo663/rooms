<template>
  <span
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 font-bold text-primary-600"
    aria-hidden="true"
  >
    <img
      v-if="pictureUrl && !broken"
      :src="pictureUrl"
      alt=""
      class="h-full w-full object-cover"
      referrerpolicy="no-referrer"
      @error="broken = true"
    />
    <template v-else>{{ initials(name) }}</template>
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { initials } from "@/features/profile/composables/profileRules";

// Decorative: whatever holds it carries the name. Size and text size come from
// the caller's class.
const props = defineProps<{
  name: string;
  pictureUrl?: string | null;
}>();

// Facebook picture URLs expire; a dead one falls back to initials rather than
// a broken-image icon.
const broken = ref(false);
watch(
  () => props.pictureUrl,
  () => (broken.value = false)
);
</script>
