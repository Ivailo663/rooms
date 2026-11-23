<template>
  <div class="rounded-2xl !p-4">
    <div class="flex items-center justify-between !mb-3">
      <span class="text-sm font-medium text-surface-500">Roster</span>
      <span class="text-xs tabular-nums text-surface-400">
        {{ spotsLeftLabel(players.length, maxPlayers) }}
      </span>
    </div>

    <!-- Seats rather than a meter (CARD-25): the taken ones are the avatars,
         the open ones the dashed rings continuing straight on from them, at
         the same size and the same quarter-diameter overlap, so the squad
         reads as one unbroken strip of seats rather than two kinds of thing.
         The rings are decorative — the count is announced once, by the label.

         The geometry mirrors SlotAvatars: the strip is indented by one seat
         inset, every seat is pulled back out of it by the overlap, and the
         avatars give the whole inset back — so the first seat on every line,
         wrapped lines included, starts at the same left edge as the header. -->
    <div
      class="flex flex-wrap items-center !gap-y-2"
      :style="{ paddingLeft: `${SEAT_INSET}px` }"
    >
      <!-- The shift sits on a wrapper, not on SlotAvatars: its row pins its
           own margin with `!m-0`, which beats any inline margin we pass. -->
      <div
        v-if="players.length"
        class="min-w-0"
        :style="{ marginLeft: `-${SEAT_INSET}px` }"
      >
        <SlotAvatars
          :players="players"
          :current-user-id="currentUserId"
          :size="SEAT_SIZE"
        />
      </div>

      <span
        v-for="seat in openSeats"
        :key="seat"
        data-open-seat
        aria-hidden="true"
        class="shrink-0 rounded-full border border-dashed border-surface-300 bg-white ring-2 ring-white"
        :style="{
          width: `${SEAT_SIZE}px`,
          height: `${SEAT_SIZE}px`,
          marginLeft: `-${SEAT_OVERLAP}px`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PlayerSummary } from "@football/shared";
import { spotsLeftLabel } from "../composables/spotsLeft";
import SlotAvatars from "./SlotAvatars.vue";

// One diameter for both kinds of seat, passed to SlotAvatars rather than
// assumed from its default, so a taken seat and an open one can't drift apart.
const SEAT_SIZE = 42;

// SlotAvatars overlaps its circles by a quarter of their width; the rings have
// to use the same figure or the strip would change rhythm halfway along.
const SEAT_OVERLAP = SEAT_SIZE / 4;

// SlotAvatars insets its first circle by that overlap plus 2px for the white
// halo (its `paddingLeft: overlap + 2`). The strip starts at the same inset, so
// a seat that wraps onto a new line sits under the first avatar, not left of it.
const SEAT_INSET = SEAT_OVERLAP + 2;

const props = defineProps<{
  players: PlayerSummary[];
  maxPlayers: number;
  currentUserId?: number;
}>();

// An over-full roster has no open seats, the same reading spotsLeftLabel takes.
const openSeats = computed(() =>
  Math.max(0, props.maxPlayers - props.players.length)
);
</script>
