<template>
  <ul
    ref="row"
    v-bind="$attrs"
    class="!m-0 flex list-none overflow-hidden !pl-2"
  >
    <li v-for="entry in visibleEntries" :key="entry.id" class="!-ml-2 shrink-0">
      <!-- click.stop: in the slot picker a tap on a neighbour tile slides it
           in, and a tap meant for an avatar must not do that as well. -->
      <button
        type="button"
        class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none !p-0 text-xs font-semibold ring-2 ring-white outline-none focus-visible:ring-emerald-500"
        :class="
          entry.isMe
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-surface-100 text-surface-600'
        "
        :aria-label="entry.label"
        @mouseenter="show(entry.player, $event)"
        @mouseleave="scheduleClose"
        @focus="show(entry.player, $event)"
        @blur="close"
        @click.stop="show(entry.player, $event)"
      >
        <span v-if="entry.initial" aria-hidden="true">{{ entry.initial }}</span>
        <i
          v-else
          class="fa-solid fa-user"
          style="font-size: 0.6rem"
          aria-hidden="true"
        />
      </button>
    </li>
    <li
      v-if="hiddenCount"
      class="!-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-surface-500 ring-2 ring-white"
      :aria-label="`${hiddenCount} more players`"
    >
      <span aria-hidden="true">+{{ hiddenCount }}</span>
    </li>
  </ul>

  <PlayerDetailsCard
    v-if="open"
    :player-id="open.player.id"
    :name="open.player.name?.trim() || 'Player'"
    :anchor="open.anchor"
    @hold="cancelClose"
    @close="close"
  />
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useElementSize } from "@vueuse/core";
import type { PlayerSummary } from "@football/shared";
import PlayerDetailsCard from "../components/PlayerDetailsCard.vue";
import { usePlayerDetails } from "../composables/usePlayerDetails";

// Two roots (the row and the teleported card), so a caller's class goes on the
// row explicitly.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  players: PlayerSummary[];
  currentUserId?: number;
}>();

// Avatars are 32px wide and overlap by 8px, so each one after the first
// advances the row by 24px; the row's left padding absorbs the first overlap.
const AVATAR_STEP = 24;

const row = useTemplateRef<HTMLElement>("row");
const { width: rowWidth } = useElementSize(row);

const { open, show, scheduleClose, cancelClose, close } = usePlayerDetails();

// The current user first, so their own avatar is never the one cut off into
// "+N". A player without a name gets a plain "Player" and an icon rather than
// an id — the id means nothing to the people reading it.
const entries = computed(() => {
  const all = props.players.map((player) => {
    const name = player.name?.trim() ?? "";
    const isMe = player.id === props.currentUserId;
    return {
      id: player.id,
      player,
      isMe,
      label: isMe ? "You" : name || "Player",
      initial: name.charAt(0).toUpperCase(),
    };
  });
  return [...all.filter((e) => e.isMe), ...all.filter((e) => !e.isMe)];
});

// One row, never wrapping: whatever doesn't fit at the measured width folds
// into a final "+N" circle, which takes the last visible slot itself. Before
// the first measurement everything renders and the row's overflow clips it.
const capacity = computed(() =>
  rowWidth.value
    ? Math.max(1, Math.floor(rowWidth.value / AVATAR_STEP))
    : Infinity
);

const visibleEntries = computed(() =>
  entries.value.length > capacity.value
    ? entries.value.slice(0, capacity.value - 1)
    : entries.value
);

const hiddenCount = computed(
  () => entries.value.length - visibleEntries.value.length
);
</script>
