<template>
  <!-- The island's right-hand block: "My games" over the soonest game. One
       button, so a tap anywhere on it opens the hub (HEAD-09). -->
  <button
    v-if="nextGame"
    type="button"
    data-my-games
    :aria-label="ariaLabel"
    class="flex min-h-11 shrink-0 cursor-pointer touch-manipulation flex-col items-end justify-center !items-center whitespace-nowrap rounded-tr-xl rounded-br-xl !px-3 text-right outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset !bg-surface-100"
    :class="
      isLive ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-emerald-50'
    "
    @click="returnToGame"
  >
    <span class="text-[0.7rem]! font-medium leading-tight text-emerald-600">
      My games
    </span>

    <span
      class="flex items-center !gap-1.5 text-xs! font-semibold leading-tight text-surface-800"
    >
      <span
        v-if="isLive"
        data-live-dot
        class="relative flex h-2 w-2 shrink-0"
        aria-hidden="true"
      >
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"
        />
        <span
          class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
        />
      </span>

      <template v-if="isLive">{{ nextGame.label }}</template>
      <template v-else>{{ dayName }} {{ nextGame.label }}</template>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameMode, returnToGame } from "../composables/useGameMode";
import { useNow } from "../composables/useNow";
import { isSlotLiveNow } from "../composables/isSlotLiveNow";
import { minutesUntil, shortDay } from "../composables/gameTime";

const { confirmedSlots } = useGameMode();
const now = useNow();

// Same pick as always: the slot that starts soonest, a live one first.
const nextGame = computed(
  () =>
    [...confirmedSlots.value].sort(
      (a, b) => minutesUntil(a, now.value) - minutesUntil(b, now.value)
    )[0]
);

const isLive = computed(
  () => !!nextGame.value && isSlotLiveNow(nextGame.value, now.value)
);

// The app's own relative label, as the hub's switcher chips use: "Today",
// "Tmrw", "Thu", "Next Thu" (HEAD-06).
const dayName = computed(() =>
  nextGame.value ? shortDay(nextGame.value, now.value) : ""
);

// The live state is a dot and a colour only, so say it for screen readers.
const ariaLabel = computed(() =>
  isLive.value
    ? `My games, game in progress, ${nextGame.value?.label}`
    : `My games, ${dayName.value} ${nextGame.value?.label}`
);
</script>
