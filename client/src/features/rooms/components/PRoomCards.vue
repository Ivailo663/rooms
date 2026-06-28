<template>
  <div
    ref="scrollContainer"
    class="deck-scroll flex flex-col !gap-4 overflow-y-auto"
  >
    <div
      v-for="room in roomList"
      :key="room.id"
      class="deck-item shrink-0 group"
    >
      <PRoomCard :room="room" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { socket } from "@/socket";
import type {
  PlayableRoomResponse,
  TimeslotMembershipChangedPayload,
} from "@football/shared";
import { useGetPlayableRooms } from "../composables/queries";
import { useActiveDay } from "@/composables/useActiveDay";
import PRoomCard from "./PRoomCard.vue";

const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";

const activeDay = useActiveDay();
const queryClient = useQueryClient();
const { data: roomList } = useGetPlayableRooms(activeDay);

const handleMembershipChanged = ({
  timeslotId,
  players,
}: TimeslotMembershipChangedPayload) => {
  queryClient.setQueryData<PlayableRoomResponse[]>(
    ["playable-rooms", activeDay.value],
    (rooms) =>
      rooms?.map((room) => ({
        ...room,
        timeslots: room.timeslots.map((slot) =>
          slot.id === timeslotId ? { ...slot, players } : slot
        ),
      }))
  );
};

onMounted(() =>
  socket.on(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, handleMembershipChanged)
);
onBeforeUnmount(() =>
  socket.off(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, handleMembershipChanged)
);
</script>

<style scoped>
.deck-scroll {
  scroll-snap-type: y mandatory;
  scroll-padding-top: 0;
  width: 100%;
  max-width: 42rem;
  margin: 0 auto;
  height: 100%;
  scrollbar-width: none;
}

@media (max-width: 640px) {
  .deck-scroll {
    max-width: 100%;
  }
}

.deck-scroll::-webkit-scrollbar {
  display: none;
}

.deck-item {
  scroll-snap-align: start;
  height: calc(100% - 3rem);
}
</style>
