<template>
  <main
    class="flex flex-col h-full"
    :class="isHostedRooms ? 'overflow-y-auto' : 'overflow-hidden'"
  >
    <Transition name="mode-switch" mode="out-in">
      <!-- In the game: the match hub owns the view -->
      <div
        v-if="showHub"
        key="hub"
        class="flex-1 min-h-0 w-full !py-6 sm:!px-6"
      >
        <MyGameHub @browse="browseGames" />
      </div>

      <!-- Browsing (primary when free agent, secondary when in a game) -->
      <div v-else key="browse" class="flex flex-col flex-1 min-h-0">
        <div class="shrink-0 w-full !pt-6 sm:!px-6">
          <ReturnToGameBar v-if="!isHostedRooms && hasGame" />
          <RoomsHeader v-model:search="search" />
        </div>

        <div
          class="w-full sm:!px-6"
          :class="isHostedRooms ? '' : 'flex-1 min-h-0'"
        >
          <HostedRooms v-if="isHostedRooms" />
          <PlayableRooms v-else :search="search" />
        </div>
      </div>
    </Transition>
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
import { useRoleStore, Cap } from "@/stores/role";
import HostedRooms from "@/features/rooms/HostedRooms.vue";
import PlayableRooms from "@/features/rooms/PlayableRooms.vue";
import MyGameHub from "@/features/rooms/MyGameHub.vue";
import CreateRoomDialog from "@/features/rooms/components/CreateRoomDialog.vue";
import RoomsHeader from "@/features/rooms/components/RoomsHeader.vue";
import ReturnToGameBar from "@/features/rooms/components/ReturnToGameBar.vue";
import { useGameMode } from "@/features/rooms/composables/useGameMode";
import { useRoomView } from "@/composables/useRoomView";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { RoomView } from "@/constants";
import { storeToRefs } from "pinia";

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);
const roleStore = useRoleStore();

const createRoomVisible = useCreateRoom();
const search = ref("");

const roomView = useRoomView();
const isHostedRooms = computed(
  () => roleStore.can(Cap.rooms.create) && roomView.value === RoomView.Host,
);

const { hasGame, showGameHub, browseGames } = useGameMode();
const showHub = computed(() => !isHostedRooms.value && showGameHub.value);

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

<style scoped>
.mode-switch-enter-active,
.mode-switch-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.mode-switch-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.99);
}
.mode-switch-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.99);
}
</style>
