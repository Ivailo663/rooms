<template>
  <main class="isolate flex flex-col h-full overflow-hidden">
    <!-- A fine pattern of tiny footballs, clear under the header (CARD-07).
         main is deliberately not `relative`: the pattern positions against
         App.vue's padded content wrapper, so it runs edge to edge past the
         padding. -z-10 inside main's isolated stacking context keeps it
         behind the cards. -->
    <div
      class="card-pattern pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
    />

    <Transition name="mode-switch" mode="out-in">
      <!-- In the game: the match hub owns the view -->
      <div v-if="showHub" key="hub" class="flex-1 min-h-0 w-full sm:!px-6">
        <MyGameHub @browse="browseGames" />
      </div>

      <!-- Browsing (primary when free agent, secondary when in a game) -->
      <div v-else key="browse" class="flex flex-col flex-1 min-h-0">
        <div class="shrink-0 w-full !mb-6">
          <ReturnToGameBar v-if="!isHostedRooms && hasGame" />
          <RoomsHeader v-model:search="search" />
        </div>

        <div class="w-full flex-1 min-h-0 sm:!px-6">
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
import { useRoleStore, Cap } from "@/stores/role";
import HostedRooms from "@/features/rooms/host/HostedRooms.vue";
import PlayableRooms from "@/features/rooms/player/PlayableRooms.vue";
import MyGameHub from "@/features/rooms/player/MyGameHub.vue";
import CreateRoomDialog from "@/features/rooms/host/CreateRoomDialog.vue";
import RoomsHeader from "@/features/rooms/components/RoomsHeader.vue";
import ReturnToGameBar from "@/features/rooms/player/ReturnToGameBar.vue";
import { useGameMode } from "@/features/rooms/composables/useGameMode";
import { useRoomView } from "@/composables/useRoomView";
import { useCreateRoom } from "@/composables/useCreateRoom";
import { RoomView } from "@/constants";

const roleStore = useRoleStore();

const createRoomVisible = useCreateRoom();
const search = ref("");

const roomView = useRoomView();
const isHostedRooms = computed(
  () => roleStore.can(Cap.rooms.create) && roomView.value === RoomView.Host
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

/* Tiny black-and-white footballs tiled over the card, staggered every other
   row. Quiet enough to read text over. */
.card-pattern {
  background-image: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cdefs%3E%3CclipPath id=%22c%22%3E%3Ccircle r=%224.2%22/%3E%3C/clipPath%3E%3Cg id=%22b%22%3E%3Ccircle r=%224.2%22 fill=%22%23fff%22/%3E%3Cg fill=%22%23000%22 clip-path=%22url%28%23c%29%22%3E%3Cpolygon points=%220.00,-1.60 1.52,-0.49 0.94,1.29 -0.94,1.29 -1.52,-0.49%22/%3E%3Cpolygon points=%220.00,5.83 -1.47,4.76 -0.91,3.03 0.91,3.03 1.47,4.76%22/%3E%3Cpolygon points=%22-5.55,1.80 -4.99,0.07 -3.16,0.07 -2.60,1.80 -4.07,2.87%22/%3E%3Cpolygon points=%22-3.43,-4.72 -1.61,-4.72 -1.04,-2.99 -2.52,-1.92 -3.99,-2.99%22/%3E%3Cpolygon points=%223.43,-4.72 3.99,-2.99 2.52,-1.92 1.04,-2.99 1.61,-4.72%22/%3E%3Cpolygon points=%225.55,1.80 4.07,2.87 2.60,1.80 3.16,0.07 4.99,0.07%22/%3E%3C/g%3E%3Ccircle r=%224.2%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%220.55%22/%3E%3C/g%3E%3C/defs%3E%3Cuse href=%22%23b%22 x=%228%22 y=%228%22/%3E%3Cuse href=%22%23b%22 x=%2228%22 y=%2228%22/%3E%3C/svg%3E");
  background-size: 40px 40px;
  opacity: 0.1;
  /* Clear under the header, full strength from the slot down. */
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    transparent 10%,
    #000 20%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    transparent 10%,
    #000 20%
  );
}
</style>
