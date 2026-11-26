<template>
  <!-- A tile is a plain group; the centred one holds a button laid over it for
       the hold (see .slot-press), so the avatars never end up nested inside a
       button. -->
  <div
    role="group"
    class="slot-tile relative flex flex-col overflow-hidden rounded-2xl border"
    :class="[
      tileSizeClasses.tile,
      centered
        ? [
            'slot-tile--current border-transparent',
            canHoldNow && 'slot-tile--actionable',
            hold.holding.value && 'slot-tile--holding',
          ]
        : 'slot-tile--side cursor-pointer text-surface-700',
    ]"
    :style="style"
    :aria-current="chosen ? 'true' : undefined"
    :aria-label="label"
  >
    <!-- Hold feedback: a faint shade rises from the bottom of the pane. -->
    <span
      v-if="centered && holdSlotAction"
      class="slot-hold-fill pointer-events-none absolute inset-0"
      aria-hidden="true"
    />
    <!-- The features are the tile's first row, in the flow, so the time below
         it centres in whatever height the row actually takes: one line, or
         more when the icons really don't fit. Nothing is measured. The row
         keeps clear of the top-left dot (8px plus a gap) and the group shrinks
         to its content, so a single line hugs the right corner and a wrapped
         one fills the row with its lines left-aligned. -->
    <span
      v-if="features.length"
      class="mb-1 flex shrink-0 justify-end"
      style="margin-left: 1rem"
    >
      <span class="flex flex-wrap justify-start !gap-1" data-features>
        <span
          v-for="feature in features"
          :key="feature"
          class="relative inline-flex size-6 items-center justify-center rounded-full"
          :class="centered ? 'slot-chip' : 'bg-surface-900/5 text-surface-500'"
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

    <div
      class="slot-time flex flex-col flex-1 gap-2 items-center justify-center"
    >
      <span
        class="slot-time-text whitespace-nowrap font-medium leading-none tabular-nums"
        :class="tileSizeClasses.time"
        data-time
      >
        {{ timeslot.label }}
      </span>
      <span v-if="timeslot.price && !pending" class="slot-price font-medium!">
        {{ timeslot.price }}€
      </span>
    </div>

    <span class="flex flex-col" :class="tileSizeClasses.gap" data-roster>
      <span
        class="flex items-baseline justify-between !gap-2 tabular-nums"
        :class="tileSizeClasses.count"
      >
        <span class="whitespace-nowrap font-medium opacity-80">
          {{ taken }} / {{ timeslot.max_players }} players
        </span>
        <span
          class="truncate text-xs font-medium"
          :class="TONE_CLASS[spotsLeftTone(taken, timeslot.max_players)]"
        >
          {{ spotsLeftLabel(taken, timeslot.max_players) }}
        </span>
      </span>
      <SpotsTakenBar
        :taken="taken"
        :max="timeslot.max_players"
        :centered="centered"
      />
      <SlotAvatars
        v-if="taken"
        :players="timeslot.players"
        :current-user-id="currentUserId"
        :size="AVATAR_SIZE[tileSize]"
        :max="avatarCap(tileSize)"
        :focusable="centered"
        class="relative z-[3]"
      />
    </span>

    <!-- The last line says what holding the tile does, or why nothing does.
         The line shimmers while it can be held, like "slide to unlock". Side
         tiles keep the space but hide it, so every tile lays out alike. When it
         is the hold's own label the button already carries it, so it is hidden
         from assistive tech here. -->
    <span
      class="slot-hint relative flex shrink-0 items-center justify-center !gap-1.5 whitespace-nowrap font-medium"
      :class="[
        tileSizeClasses.bottomGap,
        tileSizeClasses.bottomText,
        centered ? '' : 'invisible',
      ]"
      :data-tone="action.state"
      :aria-hidden="holdSlotAction ? 'true' : undefined"
    >
      <i
        v-if="pending"
        class="fa-solid fa-spinner fa-spin"
        style="font-size: 0.7rem"
      />
      <i
        v-else-if="bottomText.icon"
        :class="`fa-solid ${bottomText.icon}`"
        style="font-size: 0.7rem"
      />
      <span
        :class="{ 'slot-shimmer': canHoldNow && !hold.releasedEarly.value }"
      >
        {{ bottomText.text }}
      </span>
    </span>

    <span
      v-if="marker"
      class="absolute h-2 w-2 rounded-full"
      :class="[
        tileSizeClasses.dot,
        marker === 'joined' ? 'bg-emerald-400' : 'bg-amber-400',
      ]"
    />

    <template v-if="centered">
      <!-- Last in the tile and over everything but the avatars (z-[3]), so a
           press anywhere else on the tile is a press on this button. -->
      <button
        v-if="holdSlotAction"
        type="button"
        class="slot-press absolute inset-0 z-[1] cursor-pointer rounded-[inherit] border-none bg-transparent !p-0 outline-none"
        :aria-label="`Press and hold for one second to ${holdSlotAction}`"
        :aria-disabled="pending || blocked || undefined"
        v-on="hold.handlers"
      />
      <span class="sr-only" role="status">{{ announcement }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useIsMutating } from "@tanstack/vue-query";
import type { PlayableRoomResponse } from "@football/shared";
import { useAuthStore } from "@/stores/auth";
import {
  SLOT_MEMBERSHIP_KEY,
  useGetJoinedSlots,
  useJoinTimeslot,
  useLeaveTimeslot,
} from "../composables/queries";
import { returnToGame } from "../composables/useGameMode";
import { useNow } from "../composables/useNow";
import { AVATAR_SIZE, avatarCap, type TileSize } from "../composables/tileSize";
import { featureIconMap, slotFeatures } from "../composables/featureIcons";
import { useHoldPress } from "../composables/useHoldPress";
import { getSlotAction, tileBottomText } from "../composables/tileBottomText";
import {
  spotsLeftLabel,
  spotsLeftTone,
  type SpotsTone,
} from "../composables/spotsLeft";
import SlotAvatars from "./SlotAvatars.vue";
import SpotsTakenBar from "./SpotsTakenBar.vue";

export type SlotMarker = "joined" | "pending";

// CARD-19: how urgent the open seats are.
const TONE_CLASS: Record<SpotsTone, string> = {
  plenty: "text-emerald-700",
  few: "text-amber-700",
  full: "text-surface-500",
};

// Padding, type sizes and gaps per tile size; avatar size and cap come from
// tileSize, which also explains why the sizes are what they are.
const TILE_SIZE_CLASSES = {
  roomy: {
    tile: "!p-4",
    time: "text-3xl sm:text-4xl",
    count: "text-sm",
    gap: "!gap-2.5",
    bottomGap: "!mt-3",
    bottomText: "text-[13px]",
    dot: "left-4 top-[22px]",
  },
  compact: {
    tile: "!p-3",
    time: "text-2xl",
    count: "text-xs",
    gap: "!gap-2",
    bottomGap: "!mt-2",
    bottomText: "text-xs",
    dot: "left-3 top-[18px]",
  },
  tight: {
    tile: "!p-2",
    time: "text-xl",
    count: "text-xs",
    gap: "!gap-1",
    bottomGap: "!mt-1.5",
    bottomText: "text-xs",
    dot: "left-2 top-3.5",
  },
} as const;

// How far a neighbour recedes: at one tile's distance from the centre it is
// this much smaller and fainter, which is what puts the current tile "closer".
const NEIGHBOUR_SCALE = 0.86;
const NEIGHBOUR_OPACITY = 0.55;

const props = defineProps<{
  timeslot: PlayableRoomResponse["timeslots"][number];
  tileSize: TileSize;
  // Signed distance from the strip's middle in tile widths, capped at ±1.
  howFar: number;
  // The tile in the middle of the strip: the only one that can be held.
  centered: boolean;
  // The slot the card is showing (aria-current).
  chosen: boolean;
  marker?: SlotMarker;
  // The room's join rules, which decide what holding the tile does.
  rules: Pick<PlayableRoomResponse, "lateJoinCutoff" | "allowJoinOnLive">;
}>();

const auth = useAuthStore();
const now = useNow();
const joinMutation = useJoinTimeslot();
const leaveMutation = useLeaveTimeslot();

const currentUserId = computed(() => auth.user?.id);

// Cross-room, so the one-game-per-hour gate sees seats taken in other rooms.
// Only confirmed seats clash; pending requests aren't commitments.
const { data: joinedSlots } = useGetJoinedSlots();
const heldSlots = computed(() =>
  (joinedSlots.value ?? []).filter((slot) => slot.membership === "joined"),
);

// What holding the tile does, or why it does nothing (CARD-31, CARD-32).
const action = computed(() =>
  getSlotAction(
    props.timeslot,
    props.rules,
    now.value,
    heldSlots.value,
    currentUserId.value,
  ),
);

// This tile's own join or leave is in flight: spinner and "Joining…".
const pending = computed(
  () => joinMutation.isPending.value || leaveMutation.isPending.value,
);

// A join or leave in flight on any tile, on any card, blocks holding here until
// it settles (CARD-39).
const mutatingCount = useIsMutating({ mutationKey: SLOT_MEMBERSHIP_KEY });
const blocked = computed(() => mutatingCount.value > 0 && !pending.value);

const tileSizeClasses = computed(() => TILE_SIZE_CLASSES[props.tileSize]);
const taken = computed(() => props.timeslot.players.length);
const features = computed(() => slotFeatures(props.timeslot.features));

// What holding does: a join or leave is a 1 s hold on the centred tile
// (CARD-31..34); anything else is a status line and the tile isn't holdable.
const holdSlotAction = computed<"join" | "leave" | null>(() =>
  action.value.state === "join" || action.value.state === "leave"
    ? action.value.state
    : null,
);
const canHoldNow = computed(
  () => !!holdSlotAction.value && !pending.value && !blocked.value,
);

const join = () => {
  joinMutation.mutate(props.timeslot.id, {
    onSuccess: (data) => {
      // A confirmed join flips the play view back to the match hub, the
      // "you're in" moment. Pending approvals stay in browse mode.
      if (data.status === "joined") returnToGame();
    },
  });
};

const hold = useHoldPress({
  onHold: () => {
    if (holdSlotAction.value === "join") join();
    else if (holdSlotAction.value === "leave")
      leaveMutation.mutate(props.timeslot.id);
  },
  enabled: () => props.centered && canHoldNow.value,
});

const bottomText = computed(() =>
  tileBottomText(action.value, {
    pending: pending.value,
    releasedEarly: hold.releasedEarly.value,
  }),
);

// What a screen reader should hear change while the visible line is hidden
// from it.
const announcement = computed(() =>
  holdSlotAction.value && (pending.value || hold.releasedEarly.value)
    ? bottomText.value.text
    : "",
);

// A neighbour shrinks towards its inner edge, the one facing the centre:
// scaling about its middle would pull that edge out of the sliver of strip it
// peeks through, and the peek is what tells you there's more to swipe to. The
// hold's shade is CSS on .slot-tile--holding and never moves the tile, so it
// doesn't fight this per-frame transform.
const style = computed(() => {
  const reach = Math.abs(props.howFar);
  return {
    transform: `scale(${1 - (1 - NEIGHBOUR_SCALE) * reach})`,
    transformOrigin: props.howFar > 0 ? "left center" : "right center",
    opacity: 1 - (1 - NEIGHBOUR_OPACITY) * reach,
  };
});

// The dot and bar are visual shorthand; screen readers get them in words.
const label = computed(() => {
  const status =
    props.marker === "joined"
      ? ", you're in"
      : props.marker === "pending"
        ? ", awaiting approval"
        : "";
  const has = features.value.length
    ? `, features: ${features.value.join(", ")}`
    : "";
  return `${props.timeslot.label}, ${taken.value} of ${props.timeslot.max_players} players${status}${has}`;
});
</script>

<style scoped>
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

/* The bottom line: neutral text with a soft light sweep through it. */
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
.slot-hint[data-tone="cantJoin"],
.slot-hint[data-tone="cantLeave"] {
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
