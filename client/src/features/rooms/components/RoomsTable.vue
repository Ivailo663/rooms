<template>
  <DataTable :value="data" v-model:expandedRows="expandedRows" dataKey="id">
    <Column expander style="width: 3rem" />

    <template #expansion="rowProps">
      <RoomSlots :id="rowProps.data.id" />
    </template>
    <Column field="name" header="Name"></Column>
    <Column field="price" header="Price">
      <template #body="slotProps">
        {{ slotProps.data.price }}
      </template>
    </Column>

    <Column field="description" header="Description"></Column>

    <Column header="Status">
      <template #body="slotProps">
        <Tag :value="slotProps.data.inventoryStatus" severity="success" />
      </template>
    </Column>

    <!-- <template #footer>
      In total there are {{ products ? products.length : 0 }} products.
    </template> -->
  </DataTable>
</template>

<style scoped>
:deep(.p-datatable-row-expansion > td) {
  padding: 5rem;
  background-color: var(--p-slate-50);
}
</style>

<script setup lang="ts">
import { ref } from "vue";
import { DataTable, Tag, Column } from "primevue";
import RoomSlots from "../room-slots/components/RoomSlots.vue";
import { useGetHostedRooms } from "../composables/queries";

const expandedRows = ref([]);

const { data } = useGetHostedRooms();
</script>
