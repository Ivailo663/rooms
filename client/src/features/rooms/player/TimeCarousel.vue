<template>
  <!-- The carousel itself takes focus for the arrow keys, not each tile. Its
       touchstart stops here so a sideways swipe never reaches the window-level
       listeners (the mobile drawer's gesture). -->
  <div
    ref="emblaRef"
    class="slot-strip flex select-none overflow-hidden !py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
    role="group"
    aria-label="Time slots"
    tabindex="0"
    :data-tile-size="tileSize"
    @touchstart.passive.stop
    @keydown="onKeydown"
  >
    <div class="flex w-full shrink-0 !gap-2">
      <!-- The slide stays unscaled: Embla measures slides, and a neighbour's
           shrink is on the tile inside. -->
      <div
        v-for="(slot, index) in timeslots"
        :key="slot.id"
        class="flex min-w-0 shrink-0 grow-0"
        :style="{ flexBasis: `${TILE_WIDTH_SHARE * 100}%` }"
      >
        <TimeTile
          :timeslot="slot"
          :tile-size="tileSize"
          :how-far="howFarFromMiddle[index] ?? 0"
          :centered="index === centeredSlotIndex"
          :chosen="index === chosenSlotIndex"
          :marker="markers[slot.id]"
          :current-user-id="currentUserId"
          :action="actions[slot.id]"
          :pending="pendingSlotId === slot.id"
          :blocked="pendingSlotId !== undefined && pendingSlotId !== slot.id"
          @click="onTileClick(index)"
          @join="emit('join', slot.id)"
          @leave="emit('leave', slot.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import useEmblaCarousel from "embla-carousel-vue";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import type { PlayableRoomResponse } from "@football/shared";
import { TILE_WIDTH_SHARE } from "../composables/tileSize";
import type { TileAction } from "../composables/tileBottomText";
import { useMiddleTile } from "../composables/useMiddleTile";
import { useTileSize } from "../composables/useTileSize";
import TimeTile, { type SlotMarker } from "./TimeTile.vue";

const props = withDefaults(
  defineProps<{
    timeslots: PlayableRoomResponse["timeslots"];
    // Per-slot membership badges for the current user, keyed by slot id.
    markers?: Record<number, SlotMarker>;
    // Slot to land on when the strip mounts (e.g. the user's joined slot).
    initialIndex?: number;
    currentUserId?: number;
    // Each tile's own action by slot id, so a tile shows its line as soon as it
    // is centred; only the centred one can be held (CARD-31, CARD-32, CARD-38).
    actions?: Record<number, TileAction>;
    // The slot whose join or leave is in flight: its tile shows the spinner,
    // every other tile can't be held meanwhile (CARD-39).
    pendingSlotId?: number;
  }>(),
  {
    markers: () => ({}),
    initialIndex: 0,
    currentUserId: undefined,
    actions: () => ({}),
    pendingSlotId: undefined,
  }
);
const emit = defineEmits<{
  // Settled slot: fires once the strip stops moving.
  chooseSlot: [index: number];
  // Centred slot: follows the swipe, for anything that must match the tile on
  // screen right now.
  centerSlot: [index: number];
  join: [slotId: number];
  leave: [slotId: number];
}>();

const startIndex = Math.min(
  Math.max(props.initialIndex, 0),
  Math.max(props.timeslots.length - 1, 0)
);
// No containScroll, so the first and last tile centre too. A drag starts after
// Embla's default 10px, past the hold's 8px cancel (useHoldPress).
const [emblaRef, emblaApi] = useEmblaCarousel(
  {
    align: "center",
    containScroll: false,
    loop: false,
    skipSnaps: false,
    startIndex,
  },
  [WheelGesturesPlugin()]
);
const tileSize = useTileSize(emblaRef);
const { chosenSlotIndex, centeredSlotIndex, howFarFromMiddle, slideToSlot } =
  useMiddleTile(emblaApi, startIndex, (index) => emit("chooseSlot", index));

// The card needs to hear the starting slot too, as both the chosen and the
// centred one.
onMounted(() => {
  if (!props.timeslots.length) return;
  emit("chooseSlot", startIndex);
  emit("centerSlot", startIndex);
});

watch(centeredSlotIndex, (index) => emit("centerSlot", index));

// Only a side tile reacts to a plain tap (it slides in); the centred tile acts
// on a hold.
const onTileClick = (index: number) => {
  if (index !== centeredSlotIndex.value) slideToSlot(index);
};

// Only the strip's own focus: a key pressed on the hold button or an avatar
// belongs to that control, and sliding the tile away would unmount it.
const onKeydown = (event: KeyboardEvent) => {
  if (event.target !== event.currentTarget) return;
  if (event.key === "ArrowRight") slideToSlot(centeredSlotIndex.value + 1);
  else if (event.key === "ArrowLeft") slideToSlot(centeredSlotIndex.value - 1);
  else return;
  event.preventDefault();
};
</script>

<style scoped>
/* Sideways drags are Embla's; vertical ones stay the browser's, so the room
   deck keeps scrolling. */
.slot-strip {
  touch-action: pan-y pinch-zoom;
}
</style>
