<template>
  <main>
    <!-- <h1 v-if="Boolean(state.connected)">{{ state.connected }}</h1> -->

    <!-- <h2>{{ socketmsg }}</h2> -->

    <div class="flex">
      <div class="flex flex-col items-center" v-if="!isHostedRooms">
        <DatePicker v-model="date" inline class="my-inline-datepicker !mb-5" />

        <Timeline />
      </div>

      <div class="px-5 flex-1">
        <div class="flex justify-between !mb-5">
          <SelectButton
            v-model="room"
            :options="roomOptions"
            optionLabel="label"
            optionValue="value"
            dataKey="label"
          />

          <Button
            v-if="isHostedRooms"
            type="button"
            label="Create a room"
            severity="secondary"
            @click="visible = true"
          />
        </div>

        <HostedRooms v-if="isHostedRooms" />

        <JoinableRooms v-else />
      </div>
    </div>
  </main>

  <CreateRoomDialog v-model:visible="visible" @save="handleCreateRoom" />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { SelectButton, Button, DatePicker } from "primevue";
import { socket } from "../socket";
import { api } from "@/axios";
import { useAuthStore } from "../stores/auth";
import Timeline from "@/components/Timeline.vue";
import HostedRooms from "@/features/rooms/HostedRooms.vue";
import JoinableRooms from "@/features/rooms/JoinableRooms.vue";
import CreateRoomDialog from "@/features/rooms/components/CreateRoomDialog.vue";

const authStore = useAuthStore();

const visible = ref(false);
const date = ref();

const isHostedRooms = computed(() => room.value === "hosted");
const room = ref("hosted");
const roomOptions = ref([
  {
    label: "Hosted",
    value: "hosted",
  },
  {
    label: "Others",
    value: "others",
  },
]);

const handleCreateRoom = async ({
  name,
  description,
}: {
  name: string;
  description: string;
}) => {
  await api.post("/rooms", {
    name,
    description,
    creator_id: authStore?.user?.id,
    host_id: authStore?.user?.id,
  });

  visible.value = false;
};

const handleJoinRoom = async (room: any) => {
  await api.post("join", {
    playground_id: room.id,
    account_id: authStore?.user?.id,
    joined_at: new Date(),
  });
};

const handleLeaveRoom = async (room: any) => {
  await api.post("leave", {
    playground_id: room.id,
    account_id: authStore?.user?.id,
  });
};
</script>

<style>
.my-inline-datepicker {
  font-size: 0.85rem;
}
/* shrink the grid cells */
.my-inline-datepicker table td {
  padding: 0;
}

/* shrink the clickable day */
.my-inline-datepicker table td > span {
  width: 1.2rem;
  height: 1.2rem;
  line-height: 2rem;
  font-size: 0.85rem;
}

/* header tighter */
.my-inline-datepicker .p-datepicker-header {
  padding: 0.3rem 0.5rem;
}

/* optional: weekday labels */
.my-inline-datepicker th {
  padding: 0.2rem;
  font-size: 0.7rem;
}
</style>
