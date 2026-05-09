<template>
  <div class="flex flex-col gap-4">
    <Card
      v-for="room in roomList"
      :key="room.id"
      class="overflow-hidden border-0 bg-surface-200 shadow-none"
    >
      <template #content>
        <div>
          <div
            class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
          >
            <div class="min-w-0 md:flex-1">
              <h3 class="m-0 text-base font-medium">
                {{ room.name }}
              </h3>
              <p class="m-0 mt-2 text-sm">
                {{ room.address }}
              </p>
            </div>

            <Divider layout="vertical" class="hidden md:flex" />

            <div class="flex flex-col gap-2">
              <span class="text-xs text-surface-500">Features</span>
              <div class="flex gap-2">
                <span
                  v-for="feature in room.timeslots[selectedSlotIndex]?.features"
                  :key="feature"
                  class="h-5 w-5 rounded-full bg-emerald-50"
                  :title="feature"
                />
              </div>
            </div>

            <div class="flex flex-col gap-6 md:flex-row md:items-start">
              <Divider layout="vertical" class="hidden md:flex" />

              <div class="min-w-0 md:w-72">
                <span class="text-xs text-surface-500">Host message</span>
                <p class="m-0 mt-3 text-xs text-surface-600">
                  {{ room.timeslots[selectedSlotIndex]?.message }}
                </p>
              </div>

              <span class="text-sm font-medium text-surface-950">
                {{
                  new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }}
              </span>
            </div>
          </div>

          <Divider class="m-0" />

          <div class="flex flex-wrap gap-3 !mb-10">
            <Button
              v-for="(slot, index) in room.timeslots"
              :key="slot.id"
              severity="secondary"
              outlined
              class="min-w-[13rem] max-w-full rounded-full border border-surface-300 bg-white px-4 py-3 text-left shadow-sm transition hover:border-surface-400"
              @click="handleSelectSlot(index)"
            >
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm font-semibold">{{ slot.label }}</span>
                <span class="flex flex-col items-end">
                  <span class="text-xs">
                    {{ getSlotPlayerLabel(slot) }}
                  </span>
                </span>
              </div>
            </Button>
          </div>

          <div class="flex justify-center gap-2">
            <Button
              label="View teams"
              severity="secondary"
              text
              class="justify-self-center"
            />

            <Button
              label="Join a random team"
              severity="secondary"
              outlined
              class="justify-self-center"
              @click="handleJoin(room)"
            />
          </div>

          <span class="ml-auto block w-auto">
            {{ room.timeslots[selectedSlotIndex]?.price }} €
          </span>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button, Card, Divider } from "primevue";
import { useGetJoinableRooms } from "../composables/queries";

type Timeslot = {
  id: number;
  label: string;
  status: string;
  features: string[];
  players: { id: string; email: string; name: string }[];
  max_players: number;
};

type Room = {
  id: number;
  name: string;
  address: string;
  features: string[];
  hostMessage: string;
  price: string;
  matchPrice: string;
  timeslots: Timeslot[];
};

const emit = defineEmits<{
  join: [room: Room];
  submit: [room: Room];
}>();

const { data: roomList } = useGetJoinableRooms();
const selectedSlotIndex = ref(0);

const getSlotPlayerLabel = (slot: Timeslot) => {
  const currentPlayers = slot.players?.length ?? 0;
  const maxPlayers = slot.max_players ?? 0;
  const remaining = Math.max(0, maxPlayers - currentPlayers);

  return `${remaining} more to go (${currentPlayers}/${maxPlayers})`;
};

const handleJoin = (room: Room) => {
  emit("join", room);
  emit("submit", room);
};

const handleSelectSlot = (index: number) => {
  selectedSlotIndex.value = index;
};
</script>
