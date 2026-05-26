<template>
  <div
    class="grid !gap-4"
    style="
      grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    "
  >
    <PRoomCard v-for="room in roomList" :key="room.id" :room="room" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { socket } from "@/socket";
import type {
  JoinableRoomResponse,
  TimeslotMembershipChangedPayload,
} from "@football/shared";
import { useGetJoinableRooms } from "../composables/queries";
import PRoomCard from "./PRoomCard.vue";

const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";

const queryClient = useQueryClient();
const { data: roomList } = useGetJoinableRooms();

const handleMembershipChanged = ({
  timeslotId,
  players,
}: TimeslotMembershipChangedPayload) => {
  queryClient.setQueryData<JoinableRoomResponse[]>(
    ["joinable-rooms"],
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
