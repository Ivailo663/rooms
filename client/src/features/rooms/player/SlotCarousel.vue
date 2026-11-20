<template>
  <!-- Native horizontal scroll-snap does the gesture: the browser only claims a
       pan once it is clearly sideways, so the vertical room deck keeps
       scrolling. Touches stop here so a sideways swipe never reaches the
       window-level listeners (the mobile drawer's gesture). -->
  <!-- The strip, not each tile, takes focus for the arrow keys. A tile is a
       plain group; the centred one holds a button laid over it for the hold
       (see .slot-press), so the avatars never end up nested inside a button. -->
  <!-- overflow-y is hidden because overflow-x: auto would otherwise turn it
       into auto and let a tile that doesn't fit scroll inside the strip; the
       tile steps (CARD-17) are what make sure it fits. -->
  <div
    ref="strip"
    class="slot-strip relative flex items-center snap-x snap-mandatory !gap-2 overflow-x-auto overflow-y-hidden !py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
    :style="stripStyle"
    role="group"
    aria-label="Time slots"
    tabindex="0"
    :data-step="step"
    @touchstart.passive.stop
    @scroll.passive="onScroll"
    @keydown="onKeydown"
  >
    <div
      v-for="(slot, index) in timeslots"
      :key="slot.id"
      role="group"
      class="slot-tile relative flex shrink-0 snap-center flex-col overflow-hidden rounded-2xl border"
      :class="[
        look.tile,
        index === centredIndex
          ? [
              'slot-tile--current border-transparent',
              actionable && 'slot-tile--actionable',
              hold.holding.value && 'slot-tile--holding',
            ]
          : 'slot-tile--side cursor-pointer text-surface-700',
      ]"
      :style="tileStyle(index)"
      :aria-current="index === selectedIndex ? 'true' : undefined"
      :aria-label="tileLabel(slot)"
      @click="onTileClick(index)"
    >
      <!-- Hold feedback: a faint shade rises from the bottom of the pane. -->
      <span
        v-if="index === centredIndex && pressable"
        class="slot-hold-fill pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <!-- The features are the tile's first row, in the flow, so the time
           below it centres in whatever height the row actually takes: one line,
           or more when the icons really don't fit. Nothing is measured. The
           row keeps clear of the top-left dot (8px plus a gap) and the group
           shrinks to its content, so a single line hugs the right corner and a
           wrapped one fills the row with its lines left-aligned. -->
      <span
        v-if="slotFeatures(slot.features).length"
        class="mb-1 flex shrink-0 justify-end"
        style="margin-left: 1rem"
      >
        <span class="flex flex-wrap justify-start !gap-1" data-features>
          <span
            v-for="feature in slotFeatures(slot.features)"
            :key="feature"
            class="relative inline-flex size-6 items-center justify-center rounded-full"
            :class="
              index === centredIndex
                ? 'slot-chip'
                : 'bg-surface-900/5 text-surface-500'
            "
          >
            <i
              :class="['fa-solid', featureIconMap[feature] ?? 'fa-circle']"
              style="font-size: 0.6rem"
              aria-hidden="true"
            />
            <span class="sr-only">{{ feature }}</span>
          </span>
        </span>
      </span>

      <span class="slot-time flex flex-1 items-center justify-center">
        <span
          class="slot-time-text whitespace-nowrap font-medium leading-none tabular-nums"
          :class="look.time"
          data-time
        >
          {{ slot.label }}
        </span>
      </span>

      <span class="flex flex-col" :class="look.gap" data-roster>
        <span
          class="flex items-baseline justify-between !gap-2 tabular-nums"
          :class="look.count"
        >
          <span class="whitespace-nowrap font-medium opacity-80">
            {{ slot.players.length }} / {{ slot.max_players }} players
          </span>
          <span
            class="truncate text-xs font-medium"
            :class="
              TONE_CLASS[spotsLeftTone(slot.players.length, slot.max_players)]
            "
          >
            {{ spotsLeftLabel(slot.players.length, slot.max_players) }}
          </span>
        </span>
        <span
          v-if="hasSeatSegments(slot)"
          class="flex !gap-[3px]"
          data-seat-bar
          aria-hidden="true"
        >
          <span
            v-for="seat in slot.max_players"
            :key="seat"
            class="h-1.5 min-w-0 flex-1 rounded-full"
            :class="seatClass(slot, seat, index === centredIndex)"
            :data-filled="seat <= slot.players.length"
          />
        </span>
        <span
          v-else
          class="h-1.5 w-full overflow-hidden rounded-full"
          :class="index === centredIndex ? 'slot-seat--open' : 'bg-surface-200'"
          data-seat-bar
          aria-hidden="true"
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
          :size="AVATAR_SIZE[step]"
          :max="avatarCap(step)"
          :focusable="index === centredIndex"
          class="relative z-[3]"
        />
      </span>

      <!-- The last line says what holding the tile does, or why nothing does.
           The actionable line shimmers, like "slide to unlock". Side tiles keep
           the space but hide it, so every tile lays out alike. When it is the
           hold's own label the button already carries it, so it is hidden from
           assistive tech here. -->
      <span
        v-if="action"
        class="slot-hint relative flex shrink-0 items-center justify-center !gap-1.5 whitespace-nowrap font-medium"
        :class="[
          look.cta,
          look.hint,
          index === centredIndex ? '' : 'invisible',
        ]"
        :data-tone="action.state"
        :aria-hidden="pressable ? 'true' : undefined"
      >
        <i
          v-if="pending"
          class="fa-solid fa-spinner fa-spin"
          style="font-size: 0.7rem"
        />
        <i
          v-else-if="lineIcon"
          :class="`fa-solid ${lineIcon}`"
          style="font-size: 0.7rem"
        />
        <span :class="{ 'slot-shimmer': actionable && !hold.hint.value }">
          {{ lineText }}
        </span>
        <span
          v-if="price && action.state === 'join' && !pending"
          class="slot-price"
        >
          · {{ price }}
        </span>
      </span>

      <span
        v-if="markers[slot.id]"
        class="absolute h-2 w-2 rounded-full"
        :class="[
          look.dot,
          markers[slot.id] === 'joined' ? 'bg-emerald-400' : 'bg-amber-400',
        ]"
      />

      <template v-if="index === centredIndex">
        <!-- Last in the tile and over everything but the avatars (z-[3]), so a
             press anywhere else on the tile is a press on this button. -->
        <button
          v-if="pressable"
          type="button"
          class="slot-press absolute inset-0 z-[1] cursor-pointer rounded-[inherit] border-none bg-transparent !p-0 outline-none"
          :aria-label="`Press and hold for one second to ${action?.state}`"
          :aria-disabled="pending || undefined"
          v-on="hold.handlers"
        />
        <span class="sr-only" role="status">{{ announcement }}</span>
      </template>
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
  computed,
  useTemplateRef,
  watch,
} from "vue";
import {
  useElementSize,
  usePreferredReducedMotion,
  useResizeObserver,
} from "@vueuse/core";
import type { PlayableRoomResponse } from "@football/shared";
import {
  AVATAR_SIZE,
  STRIP_PADDING_Y,
  avatarCap,
  tileStep,
} from "../composables/slotTileStep";
import { featureIconMap, slotFeatures } from "../composables/featureIcons";
import { useHoldPress } from "../composables/useHoldPress";
import {
  spotsLeftLabel,
  spotsLeftTone,
  type SpotsTone,
} from "../composables/spotsLeft";
import SlotAvatars from "./SlotAvatars.vue";

// CARD-19: how urgent the open seats are.
const TONE_CLASS: Record<SpotsTone, string> = {
  plenty: "text-emerald-700",
  few: "text-amber-700",
  full: "text-surface-500",
};

type Slot = PlayableRoomResponse["timeslots"][number];
export type SlotMarker = "joined" | "pending";
export type TileAction = {
  state: "join" | "leave" | "awaiting" | "declined" | "status";
  label?: string;
  icon?: string;
};

const props = withDefaults(
  defineProps<{
    timeslots: Slot[];
    // Per-slot membership badges for the current user, keyed by slot id.
    markers?: Record<number, SlotMarker>;
    // Slot to land on when the strip mounts (e.g. the user's joined slot).
    initialIndex?: number;
    // Puts the current user first, in emerald, in each tile's avatar row.
    currentUserId?: number;
    // What holding the centred tile does, or why it does nothing (CARD-31,
    // CARD-32). Without it the tile shows no action line at all.
    action?: TileAction;
    // The action is in flight; the tile can't be held until it settles.
    pending?: boolean;
    // The slot's price, already formatted; shown beside "Hold to join" only.
    price?: string;
  }>(),
  {
    markers: () => ({}),
    initialIndex: 0,
    currentUserId: undefined,
    action: undefined,
    pending: false,
    price: "",
  }
);
const emit = defineEmits<{ select: [index: number]; join: []; leave: [] }>();

// How far a neighbour recedes: at one tile's distance from the centre it is
// this much smaller and fainter, which is what puts the current tile "closer".
const NEIGHBOUR_SCALE = 0.86;
const NEIGHBOUR_OPACITY = 0.55;
// Quiet time after the last scroll event before a tile counts as settled.
const SETTLE_MS = 120;

// Above this many seats the segments get too thin to read, so the bar goes
// continuous.
const MAX_SEGMENTS = 14;

// Padding, type sizes and gaps per step; avatar size and cap come from
// slotTileStep, which also explains why the steps are what they are.
const LOOKS = {
  roomy: {
    tile: "!p-4",
    time: "text-3xl sm:text-4xl",
    count: "text-sm",
    gap: "!gap-2.5",
    cta: "!mt-3",
    hint: "text-[13px]",
    dot: "left-4 top-[22px]",
  },
  compact: {
    tile: "!p-3",
    time: "text-2xl",
    count: "text-xs",
    gap: "!gap-2",
    cta: "!mt-2",
    hint: "text-xs",
    dot: "left-3 top-[18px]",
  },
  tight: {
    tile: "!p-2",
    time: "text-xl",
    count: "text-xs",
    gap: "!gap-1",
    cta: "!mt-1.5",
    hint: "text-xs",
    dot: "left-2 top-3.5",
  },
} as const;

// An open seat on the centred tile is a faint groove; on a side tile it is flat.
const seatClass = (slot: Slot, seat: number, current: boolean) => {
  const taken = seat <= slot.players.length;
  if (taken) return fillClass(slot);
  return current ? "slot-seat--open" : "bg-surface-200";
};

// The centred tile is the action itself (CARD-31..34): a join or leave is a
// 1 s hold on it, anything else is a status line and the tile isn't pressable.
const pressable = computed(
  () => props.action?.state === "join" || props.action?.state === "leave"
);
const actionable = computed(() => pressable.value && !props.pending);

const STATUS_ICON: Partial<Record<TileAction["state"], string>> = {
  awaiting: "fa-user-clock",
  declined: "fa-circle-xmark",
};

const lineIcon = computed(() =>
  props.action?.state === "status"
    ? props.action.icon
    : props.action && STATUS_ICON[props.action.state]
);

const lineText = computed(() => {
  const a = props.action;
  if (!a) return "";
  if (props.pending) return a.state === "leave" ? "Leaving…" : "Joining…";
  switch (a.state) {
    case "join":
      return hold.hint.value ? "Keep holding…" : "Hold to join";
    case "leave":
      return hold.hint.value ? "Keep holding…" : "Hold to leave";
    case "awaiting":
      return "Awaiting approval";
    case "declined":
      return "Not accepted";
    default:
      return a.label ?? "";
  }
});

// What a screen reader should hear change while the visible line is hidden
// from it.
const announcement = computed(() =>
  pressable.value && (props.pending || hold.hint.value) ? lineText.value : ""
);

const strip = useTemplateRef<HTMLElement>("strip");
const hold = useHoldPress({
  onHold: () => {
    if (props.action?.state === "join") emit("join");
    else if (props.action?.state === "leave") emit("leave");
  },
  enabled: actionable,
  scrollEl: strip,
});
const reducedMotion = usePreferredReducedMotion();
// Tiles are squares (CARD-10). The strip is measured on its border box,
// because the side padding below is derived from the square: measuring the
// content box would feed the padding back into the size. Its height doesn't
// depend on its tiles either (they are a fixed side inside a flex-1 strip).
const { width: stripWidth, height: stripHeight } = useElementSize(
  strip,
  undefined,
  { box: "border-box" }
);
// Phones can be width-bound (86% of the strip, so neighbours peek in); once
// the picker is tall and narrow that is what decides, otherwise the height does.
const TILE_SHARE = 0.86;
const side = computed(() =>
  Math.max(
    0,
    Math.floor(
      Math.min(
        stripWidth.value * TILE_SHARE,
        stripHeight.value - STRIP_PADDING_Y
      )
    )
  )
);
// Equal side padding lets the first and last square snap to the centre too:
// every tile's snap point is its own offset less half the free width.
const stripStyle = computed(() =>
  side.value
    ? { paddingInline: `${(stripWidth.value - side.value) / 2}px` }
    : undefined
);
const step = computed(() => tileStep(side.value));
const look = computed(() => LOOKS[step.value]);

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
  // The hold's shade is CSS on .slot-tile--holding and never moves the tile,
  // so it doesn't fight this per-frame transform.
  return {
    ...(side.value
      ? { width: `${side.value}px`, height: `${side.value}px` }
      : undefined),
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

const smoothness = () => (reducedMotion.value === "reduce" ? "auto" : "smooth");

const centreOn = (index: number, behavior: "auto" | "smooth") => {
  const left = centredLeft(index);
  // Scroll the strip only — scrollIntoView would also drag the vertical room
  // deck to a card that isn't on screen.
  if (left !== undefined) strip.value?.scrollTo({ left, behavior });
};

// Only a side tile reacts to a plain tap (it slides in); the centred tile acts
// on a hold.
const onTileClick = (index: number) => {
  if (index !== centredIndex.value) goTo(index);
};

// Taps and arrow keys move the strip; selection follows once it settles, so
// every route to a tile goes through the same path as a swipe.
const goTo = (index: number) => {
  const target = Math.min(Math.max(index, 0), props.timeslots.length - 1);
  centreOn(target, smoothness());
};

// Only the strip's own focus: a key pressed on the hold button or an avatar
// belongs to that control, and sliding the tile away would unmount it.
const onKeydown = (event: KeyboardEvent) => {
  if (event.target !== event.currentTarget) return;
  if (event.key === "ArrowRight") goTo(centredIndex.value + 1);
  else if (event.key === "ArrowLeft") goTo(centredIndex.value - 1);
  else return;
  event.preventDefault();
};

useResizeObserver(strip, measure);

// A resize or a rotation changes the side and the padding, so the scroll
// offset that centred the tile before no longer does. Re-centre on the
// selected slot once the new size is in the DOM.
watch([stripWidth, side], async () => {
  await nextTick();
  centreOn(selectedIndex.value, "auto");
  measure();
});

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

const hasSeatSegments = (slot: Slot) =>
  slot.max_players > 0 && slot.max_players <= MAX_SEGMENTS;

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
  const features = slotFeatures(slot.features);
  const has = features.length ? `, features: ${features.join(", ")}` : "";
  return `${slot.label}, ${slot.players.length} of ${slot.max_players} players${status}${has}`;
};
</script>

<style scoped>
/* The side padding and the tile's size are set from the measured square
   (stripStyle, tileStyle); these are only the guess for the instant before the
   first measurement. */
.slot-strip {
  padding-inline: 7%;
  scrollbar-width: none;
}

.slot-strip::-webkit-scrollbar {
  display: none;
}

.slot-tile {
  width: 100%;
  height: 100%;
  will-change: transform;
}

/* ---- Calm card (CARD-04) -------------------------------------------------
   The centred tile is a plain white card with a hairline and a soft shadow;
   side tiles are the same, flatter. No hue, no 3D. */
.slot-tile {
  -webkit-tap-highlight-color: transparent;
}

.slot-tile--current {
  color: rgb(40, 40, 40);
  border-color: rgba(0, 0, 0, 0.08);
  background: #ffffff;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 10px 24px -12px rgba(0, 0, 0, 0.2);
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* The focus ring belongs to the tile, not to the button laid over it. */
.slot-press {
  -webkit-tap-highlight-color: transparent;
}
.slot-tile--current:has(> .slot-press:focus-visible) {
  outline: 2px solid rgba(0, 0, 0, 0.55);
  outline-offset: 2px;
}

.slot-time-text {
  letter-spacing: -0.04em;
}
.slot-tile--current .slot-time-text {
  color: rgb(40, 40, 40);
}

.slot-tile--side {
  border-color: rgba(0, 0, 0, 0.07);
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  color: rgb(90, 90, 90);
}

.slot-chip {
  color: rgb(90, 90, 90);
  background: #f4f4f5;
}

.slot-seat--open {
  background: rgba(0, 0, 0, 0.08);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06);
}

/* The hint line: neutral text with a soft light sweep through it. */
.slot-hint {
  color: rgb(50, 50, 50);
}
.slot-hint[data-tone="leave"] {
  color: #b91c1c;
}
.slot-hint[data-tone="awaiting"] {
  color: #92400e;
}
.slot-hint[data-tone="declined"],
.slot-hint[data-tone="status"] {
  color: rgb(107, 107, 107);
}
.slot-price {
  color: rgb(115, 115, 115);
}
.slot-shimmer {
  background: linear-gradient(
    100deg,
    currentColor 0%,
    currentColor 42%,
    rgb(160, 160, 160) 50%,
    currentColor 58%,
    currentColor 100%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: slot-shimmer 3s ease-in-out infinite;
}
@keyframes slot-shimmer {
  0% {
    background-position: 100% 0;
  }
  60%,
  100% {
    background-position: 0% 0;
  }
}

/* Holding: a faint neutral shade rises inside the pane, under the content. */
.slot-hold-fill {
  z-index: -1;
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform 180ms ease-out;
  /* Fades out at its top, so the rising edge is soft, not a line. */
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.07),
    rgba(0, 0, 0, 0.03) 70%,
    rgba(0, 0, 0, 0)
  );
}
.slot-tile--holding .slot-hold-fill {
  transform: scaleY(1);
  transition: transform 1000ms cubic-bezier(0.4, 0, 0.6, 1);
}

/* Reduced motion: no sweep and no travel animation; the shade just
   appears while the press is held, and the full second is still required. */
@media (prefers-reduced-motion: reduce) {
  .slot-shimmer {
    animation: none;
  }
  .slot-tile--current,
  .slot-hold-fill,
  .slot-tile--holding .slot-hold-fill {
    transition: none;
  }
}
</style>
