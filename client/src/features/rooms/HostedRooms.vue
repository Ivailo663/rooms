<template>
  <div
    v-if="isPending"
    class="flex items-center justify-center !py-20 text-surface-400"
  >
    <i class="fa-solid fa-spinner fa-spin !mr-2" />
    <span class="text-sm">Loading rooms...</span>
  </div>

  <div
    v-else-if="!rooms?.length"
    class="flex flex-col items-center justify-center !py-20 text-center"
  >
    <div
      class="!mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100"
    >
      <i class="fa-solid fa-door-open text-xl text-surface-400" />
    </div>
    <h3 class="!mb-1 text-base font-semibold text-surface-700">No rooms yet</h3>
    <p class="!mb-4 text-sm text-surface-400">
      Get started by creating your first room.
    </p>
    <Button
      label="Create a room"
      icon="fa-solid fa-plus"
      text
      @click="createRoomVisible = true"
    />
  </div>

  <div v-else class="flex flex-col !gap-4">
    <RoomSettingsBar />
    <div class="grid grid-cols-1 !gap-4 lg:grid-cols-2 items-start">
      <HRoomCard v-for="room in rooms" :key="room.id" :room="room" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from "vue";
import { Button } from "primevue";
import { useQueryClient } from "@tanstack/vue-query";
import HRoomCard from "./components/HRoomCard.vue";
import RoomSettingsBar from "./components/RoomSettingsBar.vue";
import { useGetHostedRooms } from "./composables/queries";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { useActiveDay } from "@/composables/useActiveDay";
import { socket } from "@/socket";
import type { TimeslotStatusChangedPayload } from "@football/shared";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";

const createRoomVisible = useCreateRoom();
const queryClient = useQueryClient();
const activeDay = useActiveDay();
const { data: rooms, isPending } = useGetHostedRooms(activeDay);

const handleStatusChanged = ({ roomId }: TimeslotStatusChangedPayload) => {
  // Any slot transition (live / ended / failed / redistributed) can change a
  // card: its live slot, failed banner and player widget come from today's
  // slots, while its pending-request count comes from the room summary — and a
  // slot failing deletes those pending requests. Refresh both feeds so the card
  // never shows a stale status or an already-cleared request.
  queryClient.invalidateQueries({ queryKey: ["timeslots", roomId] });
  queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
};

onMounted(() => socket.on(TIMESLOT_STATUS_CHANGED_EVENT, handleStatusChanged));
onBeforeUnmount(() =>
  socket.off(TIMESLOT_STATUS_CHANGED_EVENT, handleStatusChanged),
);
</script>
