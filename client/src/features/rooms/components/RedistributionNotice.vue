<template>
  <div
    class="flex items-start !gap-2.5 rounded-xl border border-violet-100 bg-violet-50 !p-3"
  >
    <div
      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"
    >
      <i class="fa-solid fa-shuffle" style="font-size: 0.6rem" />
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-xs font-semibold text-violet-700">
        Players redistributed
      </p>
      <ul class="!mt-1 flex flex-col !gap-0.5">
        <li
          v-for="destination in notice.destinations"
          :key="destination.timeslotId"
          class="text-xs text-violet-600"
        >
          {{ destination.playerCount }}
          {{ destination.playerCount === 1 ? "player" : "players" }} moved to
          <span class="font-medium">{{ destination.roomName }}</span>
          ({{ destination.label }})
        </li>
      </ul>
    </div>

    <button
      class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-violet-400 outline-none hover:bg-violet-100 hover:text-violet-600"
      @click="emit('close')"
    >
      <i class="fa-solid fa-xmark" style="font-size: 0.6rem" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TimeslotRedistributedPayload } from "@football/shared";

defineProps<{
  notice: TimeslotRedistributedPayload;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
