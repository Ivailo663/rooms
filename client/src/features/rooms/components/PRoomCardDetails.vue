<template>
  <div class="flex flex-col">
    <div class="flex items-center !gap-2 !mb-4">
      <button
        class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white/70 transition-colors hover:bg-white/25 cursor-pointer border-none outline-none"
        @click="emit('back')"
      >
        <i class="fa-solid fa-arrow-left" style="font-size: 0.6rem" />
      </button>
      <span class="text-sm font-semibold text-white">
        {{ timeslot?.label }} — Teams
      </span>
    </div>

    <div class="flex flex-col !gap-2 max-h-48 overflow-y-auto">
      <div
        v-for="player in timeslot?.players"
        :key="player.id"
        class="flex items-center !gap-2.5 rounded-xl bg-white/10 !px-3 !py-2"
      >
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <i class="fa-solid fa-user" style="font-size: 0.55rem" />
        </div>
        <span class="text-sm text-white/90 truncate">
          {{ player.name || "Player #" + player.id }}
        </span>
      </div>

      <div
        v-if="!timeslot?.players?.length"
        class="flex flex-col items-center justify-center !gap-2 !py-6"
      >
        <i class="fa-solid fa-users text-white/20 text-2xl" />
        <span class="text-xs text-white/40">No players yet</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayableRoomResponse } from "@football/shared";

type Slot = PlayableRoomResponse["timeslots"][number];

defineProps<{ timeslot?: Slot }>();
const emit = defineEmits<{ back: [] }>();
</script>
