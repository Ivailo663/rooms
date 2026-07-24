<template>
  <button
    v-if="nextGame"
    type="button"
    class="!mb-3 flex w-full max-w-2xl cursor-pointer items-center justify-between rounded-2xl border !px-4 !py-2.5 text-sm shadow-sm transition-all outline-none !mx-auto"
    :class="
      isLive
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
        : 'border-emerald-200/70 bg-white/70 text-surface-700 backdrop-blur-sm hover:border-emerald-300 hover:bg-emerald-50/60'
    "
    @click="returnToGame"
  >
    <span class="flex min-w-0 items-center !gap-2.5">
      <span v-if="isLive" class="relative flex h-2 w-2 shrink-0">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
        />
        <span
          class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
        />
      </span>
      <i
        v-else
        class="fa-solid fa-circle-check shrink-0 text-emerald-500"
        style="font-size: 0.7rem"
      />
      <span class="truncate">
        <template v-if="isLive">
          Your game is live · {{ nextGame.roomName }}
        </template>
        <template v-else>
          Your next game · {{ dayDisplay(nextGame, now) }}
          {{ nextGame.label }} ·
          {{ nextGame.roomName }}
        </template>
      </span>
    </span>
    <span
      class="flex shrink-0 items-center !gap-1.5 text-xs font-medium text-emerald-600"
    >
      My games
      <i class="fa-solid fa-arrow-right" style="font-size: 0.6rem" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameMode, returnToGame } from "../composables/useGameMode";
import { useNow } from "../composables/useNow";
import { isSlotLiveNow } from "../composables/isSlotLiveNow";
import { dayDisplay, minutesUntil } from "../composables/gameTime";

const { confirmedSlots } = useGameMode();
const now = useNow();

const nextGame = computed(
  () =>
    [...confirmedSlots.value].sort(
      (a, b) => minutesUntil(a, now.value) - minutesUntil(b, now.value)
    )[0]
);

const isLive = computed(
  () => !!nextGame.value && isSlotLiveNow(nextGame.value, now.value)
);
</script>
