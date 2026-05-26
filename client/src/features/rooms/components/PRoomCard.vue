<template>
  <Card
    :pt="{
      body: { class: 'flex flex-col h-full' },
      content: { class: 'flex-1 flex flex-col' },
    }"
  >
    <template #content>
      <div class="flex flex-1 flex-col !gap-4">
        <!-- Header: name + date + price -->
        <div class="flex flex-col !gap-1">
          <div class="flex items-start justify-between !gap-2 !mb-2">
            <h3 class="text-base font-bold leading-tight text-surface-900">
              {{ room.name }}
            </h3>
            <div class="flex shrink-0 items-center !gap-2">
              <div class="flex items-center text-xs text-surface-400">
                <i
                  class="fa-solid fa-calendar !mr-1"
                  style="font-size: 0.6rem"
                />
                <span>{{
                  new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }}</span>
              </div>
              <div
                v-if="selectedSlot?.price"
                class="flex items-center rounded-full border border-emerald-200 bg-emerald-50 !px-2.5 !py-0.5"
              >
                <span class="text-xs font-bold text-emerald-700">
                  {{ selectedSlot.price }} €
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center text-xs text-surface-400">
            <i
              class="fa-solid fa-location-dot !mr-1"
              style="font-size: 0.65rem"
            />
            <span>{{ room.address || "Location not set" }}</span>
          </div>
        </div>

        <!-- Info panel -->
        <div class="flex flex-col !gap-3 rounded-xl bg-surface-50 !p-3">
          <div class="flex flex-col !gap-1.5">
            <p
              class="flex items-center text-xs font-semibold uppercase tracking-widest text-surface-400"
            >
              <i class="fa-solid fa-star !mr-1" style="font-size: 0.6rem" />
              Features
            </p>
            <div
              v-if="(selectedSlot?.features as string[] | undefined)?.length"
              class="flex flex-wrap !gap-1.5"
            >
              <span
                v-for="feature in selectedSlot?.features as
                  | string[]
                  | undefined"
                :key="feature"
                class="flex items-center rounded-full border border-surface-200 bg-white !px-2 !py-0.5 text-xs font-medium text-surface-700"
              >
                <i
                  :class="[
                    'fa-solid',
                    featureIconMap[feature] ?? 'fa-circle',
                    'text-primary-500',
                    '!mr-1',
                  ]"
                  style="font-size: 0.6rem"
                />
                {{ feature }}
              </span>
            </div>
            <span v-else class="text-xs italic text-surface-300"
              >No features listed</span
            >
          </div>

          <div class="flex flex-col !gap-1.5">
            <p
              class="flex items-center text-xs font-semibold uppercase tracking-widest text-surface-400"
            >
              <i class="fa-solid fa-comment !mr-1" style="font-size: 0.6rem" />
              Host message
            </p>
            <p class="text-xs leading-relaxed text-surface-600">
              {{ selectedSlot?.message || "No message from host." }}
            </p>
          </div>
        </div>

        <SlotCarousel :timeslots="room.timeslots" @select="handleSlotSelect" />
      </div>

      <!-- Footer actions -->
      <div
        class="flex items-center justify-center !gap-1 border-t border-surface-100 !mt-4 !pt-3"
      >
        <Button
          v-tooltip.top="'View teams'"
          icon="fa-solid fa-users"
          severity="secondary"
          size="small"
          label="View teams"
          text
          :disabled="!selectedSlot"
        />
        <Button
          v-if="isCurrentUserInSlot"
          v-tooltip.top="'Leave'"
          icon="fa-solid fa-right-from-bracket"
          severity="danger"
          label="Leave game"
          size="small"
          outlined
          :loading="leaveMutation.isPending.value"
          :disabled="!selectedSlot"
          @click="handleLeave"
        />
        <Button
          v-else
          v-tooltip.top="'Join'"
          icon="fa-solid fa-right-to-bracket"
          size="small"
          label="Join game"
          :loading="joinMutation.isPending.value"
          :disabled="!canJoin"
          @click="handleJoin"
        />
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Button, Card } from "primevue";
import { useJoinTimeslot, useLeaveTimeslot } from "../composables/queries";
import { useAuthStore } from "@/stores/auth";
import type { JoinableRoomResponse } from "@football/shared";
import SlotCarousel from "./SlotCarousel.vue";

type Slot = JoinableRoomResponse["timeslots"][number];

const props = defineProps<{ room: JoinableRoomResponse }>();

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

const selectedSlot = computed<Slot | undefined>(
  () => props.room.timeslots[selectedIndex.value]
);

const handleSlotSelect = (index: number) => {
  selectedIndex.value = index;
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
