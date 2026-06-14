<template>
  <main class="bg-surface-50">
    <div class="w-full !py-8 sm:!px-6">
      <RoomsHeader v-model:search="search" />

      <HostedRooms v-if="isHostedRooms" />
      <PlayableRooms v-else :search="search" />
    </div>
  </main>

  <CreateRoomDialog
    v-model:visible="createRoomVisible"
    @save="handleCreateRoom"
  />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "@/axios";
import { useAuthStore } from "../stores/auth";
import HostedRooms from "@/features/rooms/HostedRooms.vue";
import PlayableRooms from "@/features/rooms/PlayableRooms.vue";
import CreateRoomDialog from "@/features/rooms/components/CreateRoomDialog.vue";
import RoomsHeader from "@/features/rooms/components/RoomsHeader.vue";
import { useRoomView } from "@/composables/useRoomView";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { storeToRefs } from "pinia";

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const createRoomVisible = useCreateRoom();
const search = ref("");

const roomView = useRoomView();
const isHostedRooms = computed(() => roomView.value === "hosted");

const handleCreateRoom = async ({
  name,
  description,
  price,
}: {
  name: string;
  description: string;
  price: number;
}) => {
  await api.post("/rooms", {
    name,
    description,
    creator_id: user?.value?.id,
    host_id: user?.value?.id,
    price,
  });

  createRoomVisible.value = false;
};
</script>
