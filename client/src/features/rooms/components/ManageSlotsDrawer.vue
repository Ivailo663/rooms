<template>
  <Drawer
    v-model:visible="localVisible"
    position="right"
    modal
    :pt="{
      root: { class: '!w-full sm:!w-[34rem] lg:!w-[44rem]' },
      header: { class: 'border-b border-surface-100 !pb-4' },
      content: { class: '!p-5 sm:!p-6' },
    }"
  >
    <template #header>
      <div class="flex items-center !gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50"
        >
          <i
            class="fa-solid fa-sliders text-primary-500"
            style="font-size: 0.85rem"
          />
        </div>
        <div>
          <h2 class="text-base font-bold text-surface-900">
            {{ roomName }}
          </h2>
          <p class="text-xs text-surface-400">Manage time slots</p>
        </div>
      </div>
    </template>

    <RoomSlots v-if="localVisible" :id="roomId" />
  </Drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { Drawer } from "primevue";
import { useQueryClient } from "@tanstack/vue-query";
import { socket } from "@/socket";
import type { TimeslotStatusChangedPayload } from "@football/shared";
import RoomSlots from "../room-slots/components/RoomSlots.vue";

const props = defineProps<{
  visible: boolean;
  roomId: number;
  roomName: string;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const localVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit("update:visible", value),
});

const queryClient = useQueryClient();

const handleStatusChanged = ({ roomId }: TimeslotStatusChangedPayload) => {
  if (roomId !== props.roomId) return;
  queryClient.invalidateQueries({ queryKey: ["timeslots", props.roomId] });
};

const handleMembershipChanged = () => {
  queryClient.invalidateQueries({ queryKey: ["timeslots", props.roomId] });
};

onMounted(() => {
  socket.on("timeslot-status:changed", handleStatusChanged);
  socket.on("timeslot-membership:changed", handleMembershipChanged);
});

onBeforeUnmount(() => {
  socket.off("timeslot-status:changed", handleStatusChanged);
  socket.off("timeslot-membership:changed", handleMembershipChanged);
});
</script>
