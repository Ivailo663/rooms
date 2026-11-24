<template>
  <!-- Unclipped shell so the status pill can straddle the card's top edge;
       the card itself keeps overflow-hidden for its rounded glow. -->
  <div class="relative h-full w-full">
    <CardStatusPill v-if="hasJoinedSlot" status="joined" />
    <CardStatusPill v-else-if="hasPendingSlot" status="requested" />

    <div
      ref="cardEl"
      class="room-card relative flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-white/50 transition-shadow"
      :data-header-step="step"
      :class="
        hasJoinedSlot
          ? 'room-card--joined border-emerald-200'
          : 'border-surface-200/70'
      "
    >
      <!-- Soft wash bleeding down from the top edge — the card's only mood
         lighting, tinted emerald once the user holds a seat here. -->
      <div
        class="pointer-events-none absolute inset-0"
        :class="hasJoinedSlot ? 'card-glow--joined' : 'card-glow'"
      />

      <div
        class="relative flex min-h-0 flex-1 flex-col !p-6 sm:!p-7"
        data-card-body
      >
        <!-- Identity. It gives way before the picker does: shrinkable and
             clipped, so if the steps ever misjudge, the header loses a line
             instead of the picker overlapping the header (CARD-06). -->
        <div
          class="flex min-h-0 shrink flex-col overflow-hidden !mb-3 *:shrink-0"
          data-header
        >
          <h2
            class="truncate text-xl font-bold leading-tight tracking-tight text-surface-900 sm:text-2xl"
          >
            {{ room.name }}
          </h2>
          <span
            class="!mt-0.5 flex items-center !gap-1.5 text-xs text-surface-400"
          >
            <i class="fa-solid fa-location-dot" style="font-size: 0.5rem" />
            <span class="truncate">
              {{ room.address || "Location not set" }}
            </span>
          </span>

          <p
            v-if="room.description && step !== 'tight'"
            class="!mb-0 !mt-2 text-sm text-surface-600"
            :class="step === 'compact' ? 'line-clamp-1' : 'line-clamp-2'"
          >
            {{ room.description }}
          </p>
        </div>

        <template v-if="hasSlots">
          <!-- Slot picker: takes all the height between the identity block and
               the card's bottom padding, so the tiles — each carrying its own
               slot's roster and the join/leave action — grow into it. No
               panel — a border would box in the tiles' depth. -->
          <div
            class="relative flex flex-1 flex-col"
            :style="{ minHeight: `${pickerFloor}px` }"
          >
            <SlotCarousel
              class="relative min-h-0 flex-1"
              :timeslots="room.timeslots"
              :markers="slotMarkers"
              :initial-index="initialSlotIndex"
              :current-user-id="currentUserId"
              :action="selectedSlot ? tileAction : undefined"
              :pending="actionPending"
              :price="price"
              @select="handleSlotSelect"
              @join="handleJoin"
              @leave="handleLeave"
            />
            <p
              v-if="showDenial"
              class="!mb-0 !mt-1 shrink-0 text-center text-xs italic text-surface-400 line-clamp-1"
            >
              "{{ room.deniedMessage }}"
            </p>
            <!-- <p
              v-else-if="showMessage"
              class="!mb-0 !mt-1 shrink-0 text-sm italic text-surface-400 line-clamp-1"
            >
              "{{ selectedSlot?.message }}"
            </p> -->
          </div>
        </template>

        <!-- A room with no slots has nothing to pick, fill or join, so one quiet
           line stands in for the whole body and holds the card's height. -->
        <div
          v-else
          class="!mt-5 flex min-h-0 flex-1 flex-col items-center justify-center !gap-2 rounded-2xl border border-surface-100 bg-surface-50/60 !p-4"
        >
          <i class="fa-solid fa-calendar-xmark text-2xl text-surface-200" />
          <span class="text-sm text-surface-300">No time slots</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useElementSize } from "@vueuse/core";
import {
  useGetJoinedSlots,
  useJoinTimeslot,
  useLeaveTimeslot,
} from "../composables/queries";
import { returnToGame } from "../composables/useGameMode";
import { useNow } from "../composables/useNow";
import {
  getSlotJoinability,
  getSlotLeavability,
  type Joinability,
  type Leavability,
} from "../composables/slotJoinability";
import { useAuthStore } from "@/stores/auth";
import type { PlayableRoomResponse } from "@football/shared";
import { headerStep } from "../composables/headerStep";
import { PICKER_FLOOR, PICKER_NOTE } from "../composables/slotTileStep";
import CardStatusPill from "../components/CardStatusPill.vue";
import SlotCarousel, {
  type SlotMarker,
  type TileAction,
} from "./SlotCarousel.vue";

type Slot = PlayableRoomResponse["timeslots"][number];

const props = defineProps<{ room: PlayableRoomResponse }>();

const authStore = useAuthStore();
const joinMutation = useJoinTimeslot();
const leaveMutation = useLeaveTimeslot();
const now = useNow();

const currentUserId = computed(() => authStore.user?.id);

// Cross-room, so the one-game-per-hour gate can see seats taken in rooms this
// card knows nothing about. Shared query key — every card reads one fetch.
const { data: joinedSlots } = useGetJoinedSlots();

// Only confirmed seats clash; pending requests aren't commitments, matching the
// server.
const heldSlots = computed(() =>
  (joinedSlots.value ?? []).filter((slot) => slot.membership === "joined")
);

// The card's own height, not the screen's, picks how much header it can afford
// (CARD-05): the deck sizes cards, and the header steps down to leave the picker
// its floor.
const cardEl = ref<HTMLElement | null>(null);
const { height: cardHeight } = useElementSize(cardEl);
const step = computed(() => headerStep(cardHeight.value));

const selectedIndex = ref(0);

const hasSlots = computed(() => props.room.timeslots.length > 0);

const selectedSlot = computed<Slot | undefined>(
  () => props.room.timeslots[selectedIndex.value]
);

const showMessage = computed(
  () => !!selectedSlot.value?.message && step.value !== "tight"
);

const showDenial = computed(
  () => tileAction.value.state === "declined" && !!props.room.deniedMessage
);

// Either note takes a line under the strip, so the picker's floor grows by it.
const hasNote = computed(() => showMessage.value || showDenial.value);
const pickerFloor = computed(
  () => PICKER_FLOOR + (hasNote.value ? PICKER_NOTE : 0)
);

const handleSlotSelect = (index: number) => {
  selectedIndex.value = index;
};

const isCurrentUserInSlot = computed(() => {
  const slot = selectedSlot.value;
  if (!slot) return false;
  const userId = currentUserId.value;
  if (userId === undefined) return false;
  return slot.players.some((p) => p.id === userId);
});

// Membership badges per slot id, driving the carousel markers and card pill.
const slotMarkers = computed<Record<number, SlotMarker>>(() => {
  const userId = currentUserId.value;
  const markers: Record<number, SlotMarker> = {};
  if (userId === undefined) return markers;
  for (const slot of props.room.timeslots) {
    if (slot.players.some((p) => p.id === userId)) {
      markers[slot.id] = "joined";
    } else if (slot.requestStatusForCurrentUser === "pending") {
      markers[slot.id] = "pending";
    }
  }
  return markers;
});

const hasJoinedSlot = computed(() =>
  Object.values(slotMarkers.value).includes("joined")
);
const hasPendingSlot = computed(() =>
  Object.values(slotMarkers.value).includes("pending")
);

// Land the carousel on the slot the user cares about instead of index 0:
// their joined slot first, a pending request second.
const initialSlotIndex = computed(() => {
  const byMarker = (marker: SlotMarker) =>
    props.room.timeslots.findIndex(
      (slot) => slotMarkers.value[slot.id] === marker
    );
  const joined = byMarker("joined");
  if (joined >= 0) return joined;
  const pending = byMarker("pending");
  return pending >= 0 ? pending : 0;
});

const isAwaitingApproval = computed(
  () => selectedSlot.value?.requestStatusForCurrentUser === "pending"
);

// Denial lasts for the current occurrence only — the row (and this state)
// resets when the slot ends and cycles back to scheduled.
const isDeclined = computed(
  () => selectedSlot.value?.requestStatusForCurrentUser === "denied"
);

// Joinability mirrors the server's gates, so the button reflects whether a
// click would actually be accepted — no click-then-error.
const joinability = computed<Joinability>(() => {
  const slot = selectedSlot.value;
  if (!slot) return { joinable: false };
  return getSlotJoinability(slot, props.room, now.value, heldSlots.value);
});

// The mirror of joinability for a seat already taken: once the roster locks,
// the slot stays visible for the rest of its hour but the exit is gone.
const leavability = computed<Leavability>(() => {
  const slot = selectedSlot.value;
  if (!slot) return { canLeave: true };
  return getSlotLeavability(slot, props.room.lateJoinCutoff, now.value);
});

// One state for the slot tile's action line: a seat held wins, then a request
// in flight, then a denial, then the join gates.
const tileAction = computed<TileAction>(() => {
  if (isCurrentUserInSlot.value) {
    const { canLeave, label, icon } = leavability.value;
    return canLeave ? { state: "leave" } : { state: "status", label, icon };
  }
  if (isAwaitingApproval.value) return { state: "awaiting" };
  if (isDeclined.value) return { state: "declined" };
  const { joinable, label, icon } = joinability.value;
  return joinable ? { state: "join" } : { state: "status", label, icon };
});

const actionPending = computed(
  () =>
    (tileAction.value.state === "join" && joinMutation.isPending.value) ||
    (tileAction.value.state === "leave" && leaveMutation.isPending.value)
);

const price = computed(() => {
  const slot = selectedSlot.value;
  if (!slot) return "";
  return slot.price ? `${slot.price}€` : "";
});

const handleJoin = () => {
  if (!selectedSlot.value) return;
  joinMutation.mutate(selectedSlot.value.id, {
    onSuccess: (data) => {
      // A confirmed join flips the play view back to the match hub —
      // the "you're in" moment. Pending approvals stay in browse mode.
      if (data.status === "joined") returnToGame();
    },
  });
};

const handleLeave = () => {
  if (selectedSlot.value) leaveMutation.mutate(selectedSlot.value.id);
};
</script>

<style scoped>
/* One soft shadow to lift the card off the page, deepening on hover so the
   snapped card reads as the one in focus. */
.room-card {
  box-shadow: 0 8px 24px -12px rgba(15, 23, 42, 0.15);
}

.room-card:hover {
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.22);
}

.room-card--joined,
.room-card--joined:hover {
  box-shadow: 0 12px 32px -12px rgba(16, 185, 129, 0.3);
}

/* A cool halo bleeding down from the top edge, turning emerald once the user
   holds a seat — the same language as the match hub. It reaches down behind
   the slot picker, strongest there. */
.card-glow {
  background:
    radial-gradient(
      140% 75% at 70% 0%,
      rgba(99, 102, 241, 0.1) 0%,
      transparent 70%
    ),
    radial-gradient(
      120% 70% at 30% 85%,
      rgba(99, 102, 241, 0.14) 0%,
      transparent 70%
    );
}

.card-glow--joined {
  background:
    radial-gradient(
      140% 75% at 50% 0%,
      rgba(16, 185, 129, 0.16) 0%,
      transparent 72%
    ),
    radial-gradient(
      120% 70% at 30% 85%,
      rgba(16, 185, 129, 0.18) 0%,
      transparent 70%
    );
}
</style>
