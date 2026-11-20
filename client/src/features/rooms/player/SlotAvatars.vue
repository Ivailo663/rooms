<template>
  <ul
    ref="row"
    v-bind="$attrs"
    class="pointer-events-none !m-0 flex list-none overflow-hidden !py-[2px]"
    :style="{ paddingLeft: `${overlap + 2}px` }"
  >
    <li
      v-for="entry in visibleEntries"
      :key="entry.id"
      class="shrink-0"
      :style="{ marginLeft: `-${overlap}px` }"
    >
      <!-- The row ignores pointers so a press between circles reaches whatever
           is behind it (the slot picker's hold button); the circles take
           their own. click.stop: a tap on a neighbour tile slides it in, and
           a tap meant for an avatar must not do that as well. -->
      <button
        type="button"
        class="pointer-events-auto flex cursor-pointer items-center justify-center rounded-full border-none !p-0 font-semibold ring-2 ring-white outline-none focus-visible:ring-emerald-500"
        :class="
          entry.isMe
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-surface-100 text-surface-600'
        "
        :style="circleStyle"
        :aria-label="entry.label"
        :tabindex="focusable ? undefined : -1"
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
      class="flex shrink-0 items-center justify-center rounded-full bg-white font-semibold text-surface-500 ring-2 ring-white"
      :style="[circleStyle, { marginLeft: `-${overlap}px` }]"
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

const props = withDefaults(
  defineProps<{
    players: PlayerSummary[];
    currentUserId?: number;
    // Circle diameter in px; tiles shrink it when they get little height.
    size?: number;
    // Most avatars shown before the "+N" circle, even if more would fit.
    max?: number;
    // False takes the avatars out of the Tab order; they still take taps.
    focusable?: boolean;
  }>(),
  { currentUserId: undefined, size: 32, max: undefined, focusable: true }
);

// Circles overlap by a quarter of their width, so each one after the first
// advances the row by three quarters; the row's left padding absorbs the first
// overlap.
const overlap = computed(() => props.size / 4);
const step = computed(() => props.size - overlap.value);
const circleStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(10, Math.round(props.size * 0.375))}px`,
}));

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

// One row, never wrapping: whatever doesn't fit at the measured width, or
// exceeds `max`, folds into a final "+N" circle, which takes a slot itself
// (so `max` avatars plus "+N" when there are more than `max`). Before the
// first measurement everything renders and the row's overflow clips it.
const capacity = computed(() =>
  rowWidth.value
    ? Math.max(1, Math.floor(rowWidth.value / step.value))
    : Infinity
);

const visibleEntries = computed(() => {
  const total = entries.value.length;
  const shown = Math.min(total, props.max ?? total);
  const needsMore = shown < total;
  if (shown + (needsMore ? 1 : 0) <= capacity.value) {
    return entries.value.slice(0, shown);
  }
  return entries.value.slice(0, capacity.value - 1);
});

const hiddenCount = computed(
  () => entries.value.length - visibleEntries.value.length
);
</script>
