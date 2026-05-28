<template>
  <DataTable
    v-model:expanded-rows="expandedRows"
    :value="data"
    data-key="id"
    class="w-full"
    :pt="{
      tableContainer: {
        class: 'border border-surface-200 rounded-lg',
      },
    }"
  >
    <Column expander style="width: 3rem" />

    <Column field="name">
      <template #header>
        <div class="flex items-center !gap-1.5">
          <i
            class="fa-solid fa-grip text-surface-400"
            style="font-size: 0.7rem"
          />
          <span>Name</span>
        </div>
      </template>
    </Column>

    <Column>
      <template #header>
        <div class="flex items-center !gap-1.5">
          <StatusDot color="green" />
          <span>Now playing</span>
        </div>
      </template>
      <template #body="slotProps">
        <div
          v-if="slotProps.data.liveSlot"
          class="inline-flex items-center !gap-3 rounded-xl border border-emerald-100 bg-emerald-50 !px-3 !py-2"
        >
          <StatusDot color="green" :ping="true" />

          <div class="flex flex-col !gap-0.5 leading-none">
            <span class="text-sm font-bold text-surface-900">
              {{ slotProps.data.liveSlot.label }}
            </span>
            <span
              class="text-[10px] font-semibold uppercase tracking-widest text-emerald-500"
            >
              {{ slotProps.data.liveSlot.day }}
            </span>
          </div>

          <div class="h-6 w-px bg-emerald-200" />

          <div class="flex flex-col items-center !gap-0.5 leading-none">
            <span class="text-sm font-bold italic text-emerald-600">
              {{ elapsedMinutes(slotProps.data.liveSlot.start_time) }}'
            </span>
            <span class="text-[10px] text-emerald-400">elapsed</span>
          </div>

          <div class="h-6 w-px bg-emerald-200" />

          <div class="flex flex-col !gap-1">
            <div class="flex items-center !gap-1.5">
              <i
                class="fa-solid fa-users text-emerald-400"
                style="font-size: 0.6rem"
              />
              <span class="text-xs font-semibold text-surface-700">
                {{ slotProps.data.liveSlot.players_count }}/{{
                  slotProps.data.liveSlot.max_players
                }}
              </span>
            </div>
            <div class="h-1 w-16 overflow-hidden rounded-full bg-emerald-100">
              <div
                class="h-full rounded-full bg-emerald-400 transition-all"
                :style="{
                  width: `${Math.min(100, (slotProps.data.liveSlot.players_count / slotProps.data.liveSlot.max_players) * 100)}%`,
                }"
              />
            </div>
          </div>
        </div>
        <span v-else class="text-xs text-surface-300">—</span>
      </template>
    </Column>

    <Column field="price">
      <template #header>
        <div class="flex items-center !gap-1.5">
          <i
            class="fa-solid fa-wallet text-surface-400"
            style="font-size: 0.7rem"
          />
          <span>Price</span>
        </div>
      </template>
      <template #body="slotProps">
        <span v-if="slotProps.data.price" class="font-medium text-surface-900">
          {{ slotProps.data.price }} €
        </span>
        <span v-else class="text-surface-300">—</span>
      </template>
    </Column>

    <Column field="description">
      <template #header>
        <div class="flex items-center !gap-1.5">
          <i
            class="fa-solid fa-pencil text-surface-400"
            style="font-size: 0.7rem"
          />
          <span>Description</span>
        </div>
      </template>
      <template #body="slotProps">
        <span class="text-surface-600">{{
          slotProps.data.description || "—"
        }}</span>
      </template>
    </Column>

    <template #expansion="rowProps">
      <RoomSlots :id="rowProps.data.id" />
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { DataTable, Column } from "primevue";
import { useQueryClient } from "@tanstack/vue-query";
import RoomSlots from "../room-slots/components/RoomSlots.vue";
import StatusDot from "@/components/StatusDot.vue";
import { useGetHostedRooms } from "../composables/queries";
import { useNow } from "../composables/useNow";
import { socket } from "@/socket";
import type {
  HostedRoomResponse,
  TimeslotStatusChangedPayload,
} from "@football/shared";

const TIMESLOT_STATUS_CHANGED_EVENT = "timeslot-status:changed";

const expandedRows = ref([]);
const queryClient = useQueryClient();
const now = useNow();

const { data } = useGetHostedRooms();

const elapsedMinutes = (startTime: number) => {
  const n = now.value;
  return n.getHours() * 60 + n.getMinutes() - startTime;
};

const handleStatusChanged = ({
  roomId,
  status,
}: TimeslotStatusChangedPayload) => {
  if (status === "live") {
    queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
    return;
  }
  queryClient.setQueryData<HostedRoomResponse[]>(["hosted-rooms"], (current) =>
    current?.map((room) => {
      if (room.id !== roomId) return room;
      if (status === "ended") return { ...room, liveSlot: null };
      return room;
    })
  );
};

onMounted(() => socket.on(TIMESLOT_STATUS_CHANGED_EVENT, handleStatusChanged));
onBeforeUnmount(() =>
  socket.off(TIMESLOT_STATUS_CHANGED_EVENT, handleStatusChanged)
);
</script>

<style scoped>
:deep(.p-datatable-row-expansion > td) {
  padding: 2rem;
  background-color: #f8fafc;
}
</style>
