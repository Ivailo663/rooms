<template>
  <main>
    <!-- <h1 v-if="Boolean(state.connected)">{{ state.connected }}</h1> -->

    <!-- <h2>{{ socketmsg }}</h2> -->
    <div class="px-5">
      <div class="flex justify-between">
        <Button
          type="button"
          label="Create a room"
          severity="secondary"
          @click="visible = true"
        />

        <SelectButton
          v-model="room"
          :options="roomOptions"
          optionLabel="label"
          optionValue="value"
          dataKey="label"
        />
      </div>

      <Timeline />

      <div class="flex">
        <Cards
          :rooms="rooms[isHostedRooms ? 'hosted' : 'others']"
          :key="isHostedRooms.toString()"
        />
      </div>
    </div>
  </main>

  <Dialog
    v-model:visible="visible"
    modal
    header="Edit Profile"
    :style="{ width: '25rem' }"
  >
    <span class="text-surface-500 dark:text-surface-400 block mb-8!"
      >Update your information.</span
    >
    <div class="flex items-center gap-4 mb-4!">
      <label for="name" class="font-semibold w-24">name</label>
      <InputText
        id="name"
        class="flex-auto"
        autocomplete="off"
        v-model="name"
      />
    </div>
    <div class="flex items-center gap-4 mb-4!">
      <label for="name" class="font-semibold w-24">description</label>
      <Textarea
        id="name"
        class="flex-auto"
        autocomplete="off"
        v-model="description"
      />
    </div>
    <div class="flex justify-end gap-2">
      <Button
        type="button"
        label="Cancel"
        severity="secondary"
        @click="visible = false"
      ></Button>
      <Button type="button" label="Save" @click="handleCreateRoom" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, shallowReactive } from "vue";
import { SelectButton, Button, InputText, Textarea, Dialog } from "primevue";
import { socket } from "../socket";
import { api } from "@/axios";
import { useAuthStore } from "../stores/auth";

import { Player } from "@football/shared";
import Cards from "@/components/Cards.vue";
import Timeline from "@/components/Timeline.vue";
import { useQuery, useMutation } from "@tanstack/vue-query";

const authStore = useAuthStore();

const visible = ref(false);
const name = ref();
const description = ref();

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

const rooms = shallowReactive({
  hosted: [],
  others: [],
});

const handleCreateRoom = async () => {
  await api.post("/rooms", {
    name: name?.value,
    description: description?.value,
    creator_id: authStore?.user?.id,
    host_id: authStore?.user?.id,
  });
};

const getRooms = async () => {
  const { data } = await api.get("/rooms", {
    params: {
      hosted: isHostedRooms.value,
      user_id: authStore?.user?.id,
    },
  });

  rooms[isHostedRooms.value ? "hosted" : "others"] = data;

  return data;
};

const handleJoinRoom = async (room: any) => {
  await api.post("join", {
    playground_id: room.id,
    account_id: authStore?.user?.id,
    joined_at: new Date(),
  });
};

const handleLeaveRoom = async (room) => {
  await api.post("leave", {
    playground_id: room.id,
    account_id: authStore?.user?.id,
  });
};

const { isPending, isError, data, error } = useQuery({
  queryKey: ["rooms", room],
  queryFn: getRooms,
});
</script>

<style></style>
