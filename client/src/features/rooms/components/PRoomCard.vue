<template>
  <div
    class="relative h-full w-full overflow-hidden rounded-3xl"
    :class="hasJoinedSlot ? 'ring-2 ring-emerald-400/60' : undefined"
  >
    <!-- Full bleed image -->
    <div
      class="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
    >
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"
      />

      <!-- Content overlay -->
      <div class="relative flex h-full flex-col !p-6">
        <!-- Top: features + membership pill -->
        <div class="flex items-start justify-between !gap-2">
          <div
            v-if="(selectedSlot?.features as string[] | undefined)?.length"
            class="flex flex-wrap !gap-2"
          >
            <span
              v-for="feature in selectedSlot?.features as string[] | undefined"
              :key="feature"
              class="inline-flex items-center !gap-1.5 rounded-full bg-white/15 backdrop-blur-sm !px-3 !py-1.5 text-sm text-white/90"
            >
              <i
                :class="['fa-solid', featureIconMap[feature] ?? 'fa-circle']"
                style="font-size: 0.45rem"
              />
              {{ feature }}
            </span>
          </div>
          <div v-else class="flex-1" />

          <span
            v-if="hasJoinedSlot"
            class="inline-flex shrink-0 items-center !gap-1.5 rounded-full bg-emerald-400/25 backdrop-blur-sm !px-3 !py-1.5 text-sm font-medium text-emerald-100"
          >
            <i class="fa-solid fa-circle-check" style="font-size: 0.6rem" />
            Joined
          </span>
          <span
            v-else-if="hasPendingSlot"
            class="inline-flex shrink-0 items-center !gap-1.5 rounded-full bg-amber-400/25 backdrop-blur-sm !px-3 !py-1.5 text-sm font-medium text-amber-100"
          >
            <i class="fa-solid fa-user-clock" style="font-size: 0.6rem" />
            Requested
          </span>
        </div>

        <div class="flex-1" />

        <!-- Bottom panel with blur -->
        <Transition name="card-flip" mode="out-in">
          <div
            v-if="!showDetail"
            key="home"
            class="rounded-2xl bg-black/30 backdrop-blur-xl !px-5 !py-4"
          >
            <!-- Room info -->
            <div class="flex items-end justify-between !gap-3 !mb-4">
              <div class="min-w-0">
                <h2 class="text-xl font-bold text-white leading-tight truncate">
                  {{ room.name }}
                </h2>
                <div class="flex items-center !gap-1.5 !mt-1">
                  <i
                    class="fa-solid fa-location-dot text-white/50"
                    style="font-size: 0.5rem"
                  />
                  <span class="text-sm text-white/60 truncate">
                    {{ room.address || "Location not set" }}
                  </span>
                </div>
              </div>
              <span
                v-if="selectedSlot?.price"
                class="shrink-0 text-xl font-bold text-white"
              >
                {{ selectedSlot.price }}
                <span class="text-sm font-normal text-white/50">€</span>
              </span>
            </div>

            <p
              v-if="selectedSlot?.message"
              class="text-sm text-white/40 italic !mb-4 line-clamp-2"
            >
              "{{ selectedSlot.message }}"
            </p>

            <!-- Slot carousel -->
            <SlotCarousel
              :timeslots="room.timeslots"
              variant="glass"
              :markers="slotMarkers"
              :initial-index="initialSlotIndex"
              @select="handleSlotSelect"
              @teams="showDetail = true"
            />

            <!-- Join / Leave -->
            <button
              v-if="isCurrentUserInSlot && !leavability.canLeave"
              class="flex w-full items-center justify-center !gap-2 rounded-xl bg-white/10 !py-3 !mt-4 text-sm font-medium text-white/50 border border-white/10 outline-none cursor-not-allowed"
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
              class="flex w-full items-center justify-center !gap-2 rounded-xl bg-white/15 !py-3 !mt-4 text-sm font-medium text-white/90 transition-all hover:bg-white/25 cursor-pointer border border-white/10 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="leaveMutation.isPending.value || !selectedSlot"
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
              class="flex w-full items-center justify-center !gap-2 rounded-xl bg-amber-400/20 !py-3 !mt-4 text-sm font-medium text-amber-100 border border-amber-200/20 outline-none cursor-not-allowed"
              disabled
            >
              <i class="fa-solid fa-user-clock" style="font-size: 0.65rem" />
              Awaiting approval
            </button>
            <div v-else-if="isDeclined">
              <button
                class="flex w-full items-center justify-center !gap-2 rounded-xl bg-white/10 !py-3 !mt-4 text-sm font-medium text-white/50 border border-white/10 outline-none cursor-not-allowed"
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
                class="!mt-2 text-xs italic text-white/40 text-center"
              >
                "{{ room.deniedMessage }}"
              </p>
            </div>
            <button
              v-else-if="!joinability.joinable"
              class="flex w-full items-center justify-center !gap-2 rounded-xl bg-white/10 !py-3 !mt-4 text-sm font-medium text-white/50 border border-white/10 outline-none cursor-not-allowed"
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
              class="flex w-full items-center justify-center !gap-2 rounded-xl bg-white/15 !py-3 !mt-4 text-sm font-medium text-white/90 transition-all hover:bg-white/25 cursor-pointer border border-white/10 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
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

          <!-- Detail view (teams) -->
          <div
            v-else
            key="detail"
            class="rounded-2xl bg-black/30 backdrop-blur-xl !p-5"
          >
            <PRoomCardDetails
              :timeslot="selectedSlot"
              @back="showDetail = false"
            />
          </div>
        </Transition>
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
import PRoomCardDetails from "./PRoomCardDetails.vue";

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

// Cross-room, so the one-game-per-hour gate can see seats taken in rooms this
// card knows nothing about. Shared query key — every card reads one fetch.
const { data: joinedSlots } = useGetJoinedSlots();

// Only confirmed seats clash; pending requests aren't commitments, matching the
// server.
const heldSlots = computed(() =>
  (joinedSlots.value ?? []).filter((slot) => slot.membership === "joined")
);

const selectedIndex = ref(0);
const showDetail = ref(false);

const selectedSlot = computed<Slot | undefined>(
  () => props.room.timeslots[selectedIndex.value]
);

const handleSlotSelect = (index: number) => {
  selectedIndex.value = index;
  showDetail.value = false;
};

const isCurrentUserInSlot = computed(() => {
  const slot = selectedSlot.value;
  if (!slot) return false;
  const userId = authStore.user?.id;
  if (userId === undefined) return false;
  return slot.players.some((p) => p.id === userId);
});

// Membership badges per slot id, driving the carousel markers and card pill.
const slotMarkers = computed<Record<number, SlotMarker>>(() => {
  const userId = authStore.user?.id;
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
.card-flip-enter-active,
.card-flip-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.card-flip-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.card-flip-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
