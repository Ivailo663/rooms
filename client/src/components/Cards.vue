<template>
  <Card
    v-for="r in rooms"
    :key="r.id"
    style="width: 25rem; overflow: hidden"
    class="m-5! border"
  >
    <template #header>
      <img
        alt="user header"
        src="https://primefaces.org/cdn/primevue/images/usercard.png"
      />
    </template>
    <template #title>
      <div class="flex justify-between">
        <h3>{{ r.name }}</h3>

        <span>12$</span>
      </div>
    </template>
    <template #content>
      <p class="mb-2!">
        {{ r.description }}
      </p>

      <div class="flex items-center gap-2 !mb-1">
        <h2 class="!font-medium">Players</h2>

        <Badge :value="r.players.length" severity="contrast" size="small" />
      </div>
      <div class="flex gap-2">
        <p v-for="player in r.players">
          {{ player.name }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-4 mt-1">
        <Button
          v-if="!r.players?.find((p) => p.id === authStore?.user.id)"
          @click="handleJoin(p)"
          class="w-full"
          >Join</Button
        >
        <Button v-else @click="handleLeave(p)" class="w-full">Leave</Button>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import {
  Card,
  Button,
  Badge,
  InputText,
  Textarea,
  Dialog,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "primevue";

defineProps(["rooms"]);

const emit = defineEmits(["inFocus", "submit"]);

const handleJoin = (playground) => {
  emit("join");
};

const handleLeave = (playground) => {
  emit("leave");
};
</script>
