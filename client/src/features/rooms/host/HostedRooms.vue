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
      <HostedRoomCard v-for="room in rooms" :key="room.id" :room="room" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from "vue";
import { Button } from "primevue";
import { useQueryClient } from "@tanstack/vue-query";
import HostedRoomCard from "./HostedRoomCard.vue";
import RoomSettingsBar from "./RoomSettingsBar.vue";
import { useGetHostedRooms } from "../composables/queries";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { useActiveDay } from "@/composables/useActiveDay";
import { socket } from "@/socket";
import type { TimeslotStatusChangedPayload } from "@football/shared";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";
const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";

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
  // Not covered by the line above: the enabled-days key puts its discriminator
  // before the room id, so a ["timeslots", roomId] prefix never matches it.
  queryClient.invalidateQueries({
    queryKey: ["timeslots", "enabled-days", roomId],
  });
  queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
};

// Someone joined or left. The payload identifies only the slot, and a card's
// player widget can be fed by any of three queries — today's slots, the
// enabled-day summary for a later game, or the room's live slot in the hosted
// summary — so refresh all three rather than guess which card moved.
const handleMembershipChanged = () => {
  queryClient.invalidateQueries({ queryKey: ["timeslots"] });
  queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
};

onMounted(() => {
  socket.on(TIMESLOT_STATUS_CHANGED_EVENT, handleStatusChanged);
  socket.on(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, handleMembershipChanged);
});
onBeforeUnmount(() => {
  socket.off(TIMESLOT_STATUS_CHANGED_EVENT, handleStatusChanged);
  socket.off(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, handleMembershipChanged);
});
</script>
