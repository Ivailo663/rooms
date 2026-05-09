<template>
  <Timeline :value="events" class="w-[100px]">
    <template #opposite> &nbsp; </template>
    <template #content="slotProps">
      {{ slotProps.item.status }}
    </template>
  </Timeline>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Timeline } from "primevue";

const events = ref([
  { hour: 5, status: "5 PM" },
  { hour: 6, status: "6 PM" },
  { hour: 7, status: "7 PM" },
  { hour: 8, status: "8 PM" },
  { hour: 9, status: "9 PM" },
  { hour: 10, status: "10 PM" },
]);
</script>

<style>
.p-timeline-event {
  min-height: 40px !important;
}

.p-timeline-event-content {
  white-space: nowrap;
}
</style>
