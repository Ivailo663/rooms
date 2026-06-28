<template>
  <div class="relative h-full w-full overflow-hidden rounded-3xl">
    <!-- Full bleed image -->
    <div
      class="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
      :style="{
        backgroundImage: `url(https://picsum.photos/seed/${room.id}/800/1000)`,
      }"
    />
    <div
      class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10"
    />

    <!-- Content overlay -->
    <div class="relative flex h-full flex-col !p-6">
      <!-- Top: features -->
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
            @select="handleSlotSelect"
            @teams="showDetail = true"
          />

          <!-- Join / Leave -->
          <button
            v-if="isCurrentUserInSlot"
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
            v-else
            class="flex w-full items-center justify-center !gap-2 rounded-xl bg-white/15 !py-3 !mt-4 text-sm font-medium text-white/90 transition-all hover:bg-white/25 cursor-pointer border border-white/10 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!canJoin || joinMutation.isPending.value"
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
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useJoinTimeslot, useLeaveTimeslot } from "../composables/queries";
import { useAuthStore } from "@/stores/auth";
import type { PlayableRoomResponse } from "@football/shared";
import SlotCarousel from "./SlotCarousel.vue";
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

const canJoin = computed(() => {
  const slot = selectedSlot.value;
  if (!slot) return false;
  return slot.players.length < slot.max_players;
});

const handleJoin = () => {
  if (selectedSlot.value) joinMutation.mutate(selectedSlot.value.id);
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
