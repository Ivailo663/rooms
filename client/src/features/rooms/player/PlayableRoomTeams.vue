<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 items-center !gap-2 !mb-3">
      <button
        class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-surface-200 bg-white text-surface-400 outline-none transition-colors hover:border-surface-300 hover:text-surface-700"
        @click="emit('back')"
      >
        <i class="fa-solid fa-arrow-left" style="font-size: 0.6rem" />
      </button>
      <span class="text-sm font-medium text-surface-500">
        {{ timeslot?.label }} — Teams
      </span>
    </div>

    <div class="flex min-h-0 flex-1 flex-col !gap-2 overflow-y-auto">
      <div
        v-for="player in timeslot?.players"
        :key="player.id"
        class="flex shrink-0 items-center !gap-2.5 rounded-xl border border-surface-100 bg-white !px-3 !py-2"
      >
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-100 text-surface-500"
        >
          <i class="fa-solid fa-user" style="font-size: 0.55rem" />
        </div>
        <span class="truncate text-sm text-surface-700">
          {{ player.name || "Player #" + player.id }}
        </span>
      </div>

      <div
        v-if="!timeslot?.players?.length"
        class="flex flex-col items-center justify-center !gap-2 !py-6"
      >
        <i class="fa-solid fa-users text-2xl text-surface-200" />
        <span class="text-xs text-surface-300">No players yet</span>
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
