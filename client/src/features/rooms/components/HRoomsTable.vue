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

    <Column>
      <template #header>
        <div class="flex items-center !gap-1.5">
          <i
            class="fa-solid fa-circle text-surface-400"
            style="font-size: 0.7rem"
          />
          <span>Status</span>
        </div>
      </template>
      <template #body="slotProps">
        <Tag
          :value="slotProps.data.inventoryStatus ?? 'Active'"
          severity="success"
        />
      </template>
    </Column>

    <template #expansion="rowProps">
      <RoomSlots :id="rowProps.data.id" />
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DataTable, Tag, Column } from "primevue";
import RoomSlots from "../room-slots/components/RoomSlots.vue";
import { useGetHostedRooms } from "../composables/queries";

const expandedRows = ref([]);

const { data } = useGetHostedRooms();
</script>

<style scoped>
:deep(.p-datatable-row-expansion > td) {
  padding: 2rem;
  background-color: #f8fafc;
}
</style>
