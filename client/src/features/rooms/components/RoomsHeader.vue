<template>
  <div class="!mb-8 items-center">
    <!-- Center: search -->
    <div class="flex flex-col items-center">
      <h1 class="text-xl font-bold tracking-tight text-surface-900">
        {{ isHostedRooms ? "Your Rooms" : "Discover Rooms" }}
      </h1>
      <p class="text-sm text-surface-400 !mb-2">
        {{
          isHostedRooms
            ? "Manage and configure your hosted rooms"
            : "Browse available rooms and reserve a slot"
        }}
      </p>

      <InputGroup v-if="!isHostedRooms" class="neon-border w-full max-w-lg">
        <InputText
          :model-value="search"
          type="text"
          class="flex-1"
          placeholder="Type anything to search..."
          @update:model-value="(val) => emit('update:search', val ?? '')"
        />
        <InputGroupAddon>
          <i class="pi pi-search !text-sm" />
          <span class="text-xs !ml-1.5 text-surface-500 whitespace-nowrap"
            >AI powered</span
          >
        </InputGroupAddon>
      </InputGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { InputText, InputGroup, InputGroupAddon } from "primevue";
import { useRoomView } from "@/composables/useRoomView";

defineProps<{ search: string }>();

const emit = defineEmits<{
  "update:search": [value: string];
}>();

const roomView = useRoomView();
const isHostedRooms = computed(() => roomView.value === "hosted");
</script>

<style scoped>
@property --neon-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes neon-spin {
  to {
    --neon-angle: 360deg;
  }
}

.neon-border {
  padding: 2px;
  background: conic-gradient(
    from var(--neon-angle),
    #a855f7,
    #3b82f6,
    #06b6d4,
    #ec4899,
    #a855f7
  );
  border-radius: 8px;
  animation: neon-spin 1.5s linear infinite;
}

.neon-border :deep(.p-inputtext),
.neon-border :deep(.p-inputgroup-addon) {
  border: none !important;
}

.neon-border :deep(.p-inputgroup-addon:first-child) {
  border-radius: 6px 0 0 6px !important;
}

.neon-border :deep(.p-inputgroup-addon:last-child) {
  border-radius: 0 6px 6px 0 !important;
}

.neon-border :deep(.p-inputtext:focus) {
  box-shadow: none !important;
  outline: none !important;
}
</style>
