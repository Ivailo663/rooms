<template>
  <!-- Unclipped shell so the status pill can straddle the card's top edge;
       the card itself keeps overflow-hidden for its rounded glow. -->
  <div class="relative h-full w-full">
    <span
      v-if="hasJoinedSlot"
      class="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center !gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 !px-2 !py-0.5 text-[0.6rem] font-bold uppercase leading-none tracking-widest text-emerald-600"
    >
      <i class="fa-solid fa-circle-check" style="font-size: 0.5rem" />
      You're in
    </span>
    <span
      v-else-if="hasPendingSlot"
      class="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center !gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 !px-2 !py-0.5 text-[0.6rem] font-bold uppercase leading-none tracking-widest text-amber-600"
    >
      <i class="fa-solid fa-user-clock" style="font-size: 0.5rem" />
      Requested
    </span>

    <div
      class="room-card relative flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-white transition-shadow"
      :class="
        hasJoinedSlot
          ? 'room-card--joined border-emerald-200'
          : 'border-surface-200/70'
      "
    >
      <!-- Soft wash bleeding down from the top edge — the card's only mood
         lighting, tinted emerald once the user holds a seat here. -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-40"
        :class="hasJoinedSlot ? 'card-glow--joined' : 'card-glow'"
      />

      <div class="relative flex min-h-0 flex-1 flex-col !p-6 sm:!p-7">
        <!-- Identity -->
        <div class="flex shrink-0 flex-col !mb-5">
          <h2
            class="truncate text-2xl font-bold leading-tight tracking-tight text-surface-900"
          >
            {{ room.name }}
          </h2>
          <span
            class="!mt-1 flex items-center !gap-1.5 text-sm text-surface-400"
          >
            <i class="fa-solid fa-location-dot" style="font-size: 0.55rem" />
            <span class="truncate">
              {{ room.address || "Location not set" }}
            </span>
          </span>

          <p
            v-if="room.description"
            class="!mb-0 !mt-3 text-sm text-surface-600 line-clamp-2"
          >
            {{ room.description }}
          </p>

          <div
            v-if="features.length || selectedSlot?.price"
            class="!mt-3 flex flex-wrap items-center !gap-2"
          >
            <span
              v-for="feature in features"
              :key="feature"
              class="inline-flex items-center !gap-1.5 rounded-full bg-surface-100 !px-3 !py-1.5 text-xs font-medium text-surface-600"
            >
              <i
                :class="['fa-solid', featureIconMap[feature] ?? 'fa-circle']"
                style="font-size: 0.5rem"
              />
              {{ feature }}
            </span>
            <span
              v-if="selectedSlot?.price"
              class="!ml-auto inline-flex items-center rounded-full bg-emerald-50 !px-3 !py-1.5 text-xs font-bold text-emerald-700"
            >
              {{ selectedSlot.price }}€
            </span>
          </div>
        </div>

        <template v-if="hasSlots">
          <!-- Slot picker: takes all the height between the identity block and
               Join, so the tiles — each carrying its own slot's roster — grow
               into it. No panel — a border would box in the tiles' depth. -->
          <div class="flex min-h-0 flex-1 flex-col">
            <SlotCarousel
              class="min-h-[10rem] flex-1"
              :timeslots="room.timeslots"
              :markers="slotMarkers"
              :initial-index="initialSlotIndex"
              :current-user-id="currentUserId"
              @select="handleSlotSelect"
            />
            <p
              v-if="selectedSlot?.message"
              class="!mb-0 !mt-1 shrink-0 text-sm italic text-surface-400 line-clamp-2"
            >
              "{{ selectedSlot.message }}"
            </p>
          </div>

          <div class="shrink-0 !mt-4" :class="{ '!mt-auto': !selectedSlot }">
            <button
              v-if="isCurrentUserInSlot && !leavability.canLeave"
              class="flex w-full items-center justify-center !gap-2 rounded-xl border border-surface-100 bg-surface-50 !py-3 text-sm font-medium text-surface-400 outline-none cursor-not-allowed"
              disabled
            >
              <i
                :class="`fa-solid ${leavability.icon}`"
                style="font-size: 0.65rem"
              />
              {{ leavability.label }}
            </button>
            <button
              v-else-if="isCurrentUserInSlot"
              class="flex w-full items-center justify-center !gap-2 rounded-xl border border-surface-200 bg-white !py-3 text-sm font-medium text-surface-500 transition-all hover:border-surface-300 hover:text-surface-700 cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="leaveMutation.isPending.value"
              @click="handleLeave"
            >
              <i
                :class="
                  leaveMutation.isPending.value
                    ? 'fa-solid fa-spinner fa-spin'
                    : 'fa-solid fa-right-from-bracket'
                "
                style="font-size: 0.65rem"
              />
              Leave game
            </button>
            <button
              v-else-if="isAwaitingApproval"
              class="flex w-full items-center justify-center !gap-2 rounded-xl border border-amber-100 bg-amber-50 !py-3 text-sm font-medium text-amber-600 outline-none cursor-not-allowed"
              disabled
            >
              <i class="fa-solid fa-user-clock" style="font-size: 0.65rem" />
              Awaiting approval
            </button>
            <div v-else-if="isDeclined">
              <button
                class="flex w-full items-center justify-center !gap-2 rounded-xl border border-surface-100 bg-surface-50 !py-3 text-sm font-medium text-surface-400 outline-none cursor-not-allowed"
                disabled
              >
                <i
                  class="fa-solid fa-circle-xmark"
                  style="font-size: 0.65rem"
                />
                Not accepted for this slot
              </button>
              <p
                v-if="room.deniedMessage"
                class="!mt-2 text-center text-xs italic text-surface-400"
              >
                "{{ room.deniedMessage }}"
              </p>
            </div>
            <button
              v-else-if="!joinability.joinable"
              class="flex w-full items-center justify-center !gap-2 rounded-xl border border-surface-100 bg-surface-50 !py-3 text-sm font-medium text-surface-400 outline-none cursor-not-allowed"
              disabled
            >
              <i
                :class="`fa-solid ${joinability.icon}`"
                style="font-size: 0.65rem"
              />
              {{ joinability.label }}
            </button>
            <button
              v-else
              class="join-button flex w-full items-center justify-center !gap-2 rounded-xl border-none bg-emerald-600 !py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="joinMutation.isPending.value"
              @click="handleJoin"
            >
              <i
                :class="
                  joinMutation.isPending.value
                    ? 'fa-solid fa-spinner fa-spin'
                    : 'fa-solid fa-right-to-bracket'
                "
                style="font-size: 0.65rem"
              />
              Join game
            </button>
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
import SlotCarousel, { type SlotMarker } from "./SlotCarousel.vue";

type Slot = PlayableRoomResponse["timeslots"][number];

const props = defineProps<{ room: PlayableRoomResponse }>();

const featureIconMap: Record<string, string> = {
  ball: "fa-futbol",
  showers: "fa-shower",
  parking: "fa-square-parking",
  lights: "fa-sun",
  water: "fa-bottle-water",
};

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

const selectedIndex = ref(0);

const hasSlots = computed(() => props.room.timeslots.length > 0);

const selectedSlot = computed<Slot | undefined>(
  () => props.room.timeslots[selectedIndex.value]
);

const features = computed(() =>
  Array.isArray(selectedSlot.value?.features)
    ? (selectedSlot.value.features as string[])
    : []
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
   holds a seat — the same language as the match hub. */
.card-glow {
  background: radial-gradient(
    120% 100% at 50% 0%,
    rgba(99, 102, 241, 0.08) 0%,
    transparent 70%
  );
}

.card-glow--joined {
  background: radial-gradient(
    120% 100% at 50% 0%,
    rgba(16, 185, 129, 0.16) 0%,
    transparent 72%
  );
}

.join-button {
  box-shadow: 0 6px 16px -8px rgba(16, 185, 129, 0.7);
}
</style>
