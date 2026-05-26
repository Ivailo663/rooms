<template>
  <div
    v-if="isPending"
    class="flex items-center justify-center !py-20 text-surface-400"
  >
    <i class="fa-solid fa-spinner fa-spin !mr-2" />
    <span class="text-sm">Loading rooms…</span>
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

  <HostedRoomsTable v-else />
</template>

<script lang="ts" setup>
import { Button } from "primevue";
import HostedRoomsTable from "./components/HRoomsTable.vue";
import { useGetHostedRooms } from "./composables/queries";
import { useCreateRoom } from "@/composables/useCreateRoom";

const createRoomVisible = useCreateRoom();
const { data: rooms, isPending } = useGetHostedRooms();
</script>
