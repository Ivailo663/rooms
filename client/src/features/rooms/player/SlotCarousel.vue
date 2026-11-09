<template>
  <!-- Native horizontal scroll-snap does the gesture: the browser only claims a
       pan once it is clearly sideways, so the vertical room deck keeps
       scrolling. Touches stop here so a sideways swipe never reaches the
       window-level listeners (the mobile drawer's gesture). -->
  <!-- The strip, not each tile, takes focus for the arrow keys: a tile is a
       plain container so the avatars inside it can be buttons of their own. -->
  <div
    ref="strip"
    class="slot-strip relative flex snap-x snap-mandatory !gap-2 overflow-x-auto !py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
    role="group"
    aria-label="Time slots"
    tabindex="0"
    @touchstart.passive.stop
    @scroll.passive="onScroll"
    @keydown="onKeydown"
  >
    <div
      v-for="(slot, index) in timeslots"
      :key="slot.id"
      role="group"
      class="slot-tile relative flex shrink-0 snap-center flex-col justify-between rounded-2xl !p-4 sm:!p-5"
      :class="[
        index === centredIndex
          ? 'slot-tile--current bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-400'
          : 'cursor-pointer bg-surface-100 text-surface-700',
      ]"
      :style="tileStyle(index)"
      :aria-current="index === selectedIndex ? 'true' : undefined"
      :aria-label="tileLabel(slot)"
      @click="goTo(index)"
    >
      <span
        class="whitespace-nowrap text-3xl font-bold leading-none tracking-tight tabular-nums sm:text-4xl"
      >
        {{ slot.label }}
      </span>

      <span class="flex flex-col !gap-2.5">
        <span
          class="flex items-baseline justify-between !gap-2 text-sm tabular-nums"
        >
          <span class="whitespace-nowrap font-medium opacity-80">
            {{ slot.players.length }} / {{ slot.max_players }} players
          </span>
          <span class="truncate text-xs opacity-70">
            {{ spotsLeftLabel(slot.players.length, slot.max_players) }}
          </span>
        </span>
        <span
          class="h-1.5 w-full overflow-hidden rounded-full"
          :class="index === centredIndex ? 'bg-emerald-100' : 'bg-surface-200'"
        >
          <span
            class="block h-full rounded-full"
            :class="fillClass(slot)"
            :style="{ width: `${fillPercent(slot)}%` }"
          />
        </span>
        <SlotAvatars
          v-if="slot.players.length"
          :players="slot.players"
          :current-user-id="currentUserId"
        />
        <span v-else class="flex h-8 items-center text-sm opacity-60">
          No one's in yet
        </span>
      </span>

      <span
        v-if="markers[slot.id]"
        class="absolute right-4 top-4 h-2 w-2 rounded-full"
        :class="
          markers[slot.id] === 'joined' ? 'bg-emerald-500' : 'bg-amber-500'
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  shallowRef,
  onMounted,
  onBeforeUnmount,
  nextTick,
  useTemplateRef,
} from "vue";
import { usePreferredReducedMotion, useResizeObserver } from "@vueuse/core";
import type { PlayableRoomResponse } from "@football/shared";
import { spotsLeftLabel } from "../composables/spotsLeft";
import SlotAvatars from "./SlotAvatars.vue";

type Slot = PlayableRoomResponse["timeslots"][number];
export type SlotMarker = "joined" | "pending";

const props = withDefaults(
  defineProps<{
    timeslots: Slot[];
    // Per-slot membership badges for the current user, keyed by slot id.
    markers?: Record<number, SlotMarker>;
    // Slot to land on when the strip mounts (e.g. the user's joined slot).
    initialIndex?: number;
    // Puts the current user first, in emerald, in each tile's avatar row.
    currentUserId?: number;
  }>(),
  { markers: () => ({}), initialIndex: 0, currentUserId: undefined }
);
const emit = defineEmits<{ select: [index: number] }>();

// How far a neighbour recedes: at one tile's distance from the centre it is
// this much smaller and fainter, which is what puts the current tile "closer".
const NEIGHBOUR_SCALE = 0.86;
const NEIGHBOUR_OPACITY = 0.55;
// Quiet time after the last scroll event before a tile counts as settled.
const SETTLE_MS = 120;

const strip = useTemplateRef<HTMLElement>("strip");
const reducedMotion = usePreferredReducedMotion();

// selectedIndex is what the card shows (and what's emitted); centredIndex
// follows the finger so the highlight moves with the swipe, not after it.
const selectedIndex = ref(0);
const centredIndex = ref(0);
// Each tile's signed distance from the strip's centre, in tile widths, capped
// at ±1: negative to the left, positive to the right.
const distances = shallowRef<number[]>([]);

const tiles = () =>
  strip.value
    ? (Array.from(strip.value.children) as HTMLElement[])
    : ([] as HTMLElement[]);

const measure = () => {
  const el = strip.value;
  if (!el) return;
  const centre = el.scrollLeft + el.clientWidth / 2;
  let nearest = 0;
  let nearestGap = Infinity;
  distances.value = tiles().map((tile, index) => {
    const offset = tile.offsetLeft + tile.offsetWidth / 2 - centre;
    if (Math.abs(offset) < nearestGap) {
      nearestGap = Math.abs(offset);
      nearest = index;
    }
    return Math.max(-1, Math.min(1, offset / tile.offsetWidth));
  });
  centredIndex.value = nearest;
};

// A neighbour shrinks towards its inner edge, the one facing the centre:
// scaling about its middle would pull that edge out of the sliver of strip it
// peeks through, and the peek is what tells you there's more to swipe to.
const tileStyle = (index: number) => {
  const d = distances.value[index] ?? 0;
  const reach = Math.abs(d);
  return {
    transform: `scale(${1 - (1 - NEIGHBOUR_SCALE) * reach})`,
    transformOrigin: d > 0 ? "left center" : "right center",
    opacity: 1 - (1 - NEIGHBOUR_OPACITY) * reach,
  };
};

const select = (index: number) => {
  if (index === selectedIndex.value) return;
  selectedIndex.value = index;
  emit("select", index);
};

let frame = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;

const onScroll = () => {
  if (!frame) {
    frame = requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  }
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    measure();
    select(centredIndex.value);
    // Desktop trackpads often leave scroll-snap short of the snap point, so
    // finish the job: glide the nearest tile the rest of the way to centre.
    // Once it lands, this check passes and the nudging stops.
    const el = strip.value;
    const target = centredLeft(centredIndex.value);
    if (el && target !== undefined && Math.abs(el.scrollLeft - target) > 1) {
      centreOn(centredIndex.value, smoothness());
    }
  }, SETTLE_MS);
};

const centredLeft = (index: number) => {
  const el = strip.value;
  const tile = tiles()[index];
  if (!el || !tile) return undefined;
  return tile.offsetLeft - (el.clientWidth - tile.offsetWidth) / 2;
};

const smoothness = () =>
  reducedMotion.value === "reduce" ? "auto" : "smooth";

const centreOn = (index: number, behavior: "auto" | "smooth") => {
  const left = centredLeft(index);
  // Scroll the strip only — scrollIntoView would also drag the vertical room
  // deck to a card that isn't on screen.
  if (left !== undefined) strip.value?.scrollTo({ left, behavior });
};

// Taps and arrow keys move the strip; selection follows once it settles, so
// every route to a tile goes through the same path as a swipe.
const goTo = (index: number) => {
  const target = Math.min(Math.max(index, 0), props.timeslots.length - 1);
  centreOn(target, smoothness());
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "ArrowRight") goTo(centredIndex.value + 1);
  else if (event.key === "ArrowLeft") goTo(centredIndex.value - 1);
  else return;
  event.preventDefault();
};

useResizeObserver(strip, measure);

onMounted(async () => {
  if (!props.timeslots.length) return;
  const initial = Math.min(
    Math.max(props.initialIndex, 0),
    props.timeslots.length - 1
  );
  selectedIndex.value = initial;
  centredIndex.value = initial;
  emit("select", initial);
  await nextTick();
  centreOn(initial, "auto");
  measure();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  clearTimeout(settleTimer);
});

const fillPercent = (slot: Slot) =>
  slot.max_players
    ? Math.min(100, (slot.players.length / slot.max_players) * 100)
    : 0;

const fillClass = (slot: Slot) =>
  slot.max_players && slot.players.length >= slot.max_players
    ? "bg-surface-400"
    : "bg-emerald-500";

// The dot and bar are visual shorthand; screen readers get them in words.
const tileLabel = (slot: Slot) => {
  const marker = props.markers[slot.id];
  const status =
    marker === "joined"
      ? ", you're in"
      : marker === "pending"
        ? ", awaiting approval"
        : "";
  return `${slot.label}, ${slot.players.length} of ${slot.max_players} players${status}`;
};
</script>

<style scoped>
/* The side padding alone sizes the tile: each tile is the full content box,
   i.e. the strip minus both paddings, so it is exactly centred at every snap
   point (first and last included) and neighbours peek in through the padding.
   Phones: tile = 86% of the strip, leaving each neighbour a ~15px sliver;
   wider screens: 90%. */
.slot-strip {
  padding-inline: 7%;
  scrollbar-width: none;
}

@media (min-width: 640px) {
  .slot-strip {
    padding-inline: 5%;
  }
}

.slot-strip::-webkit-scrollbar {
  display: none;
}

.slot-tile {
  width: 100%;
  will-change: transform;
}

.slot-tile--current {
  box-shadow: 0 14px 30px -14px rgba(16, 185, 129, 0.5);
}
</style>
