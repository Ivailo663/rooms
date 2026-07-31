<template>
  <div
    class="flex items-center !gap-3 rounded-xl border border-rose-100 bg-rose-50 !p-3"
  >
    <div
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500"
    >
      <i class="fa-solid fa-user-slash" style="font-size: 0.7rem" />
    </div>

    <div class="min-w-0 flex-1">
      <p class="flex items-baseline !gap-2 leading-none">
        <span
          v-if="slotLabel"
          class="text-lg font-bold text-rose-700 tracking-tight"
        >
          {{ slotLabel }}
        </span>
        <span class="text-xs font-semibold text-rose-600">
          Not enough players
        </span>
      </p>
      <p class="!mt-1 text-xs text-rose-500/90">
        {{ detail }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  playersCount: number;
  minPlayers: number | null;
  // Optional slot label (e.g. "19:00"). When passed it becomes the headline —
  // the failed hour is the thing the host scans for. Worth passing where the
  // notice sits apart from the slot it refers to (e.g. the room card).
  slotLabel?: string;
}>();

// The headline already carries the "what" (the hour) and "Not enough players";
// this line is just the supporting count.
const detail = computed(() =>
  props.minPlayers != null
    ? `Only ${props.playersCount} of ${props.minPlayers} joined in time — no game this round.`
    : `Not enough players joined in time — no game this round.`
);
</script>
