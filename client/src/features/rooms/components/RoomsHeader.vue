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

      <!-- Filter pills -->
      <div
        v-if="!isHostedRooms"
        class="!mt-3 flex w-full max-w-lg flex-wrap items-center justify-center !gap-1.5"
      >
        <button
          v-for="day in DAYS"
          :key="day.value"
          type="button"
          class="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-xs font-semibold transition-colors"
          :class="
            activeDay === day.value
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-surface-200 bg-white text-surface-500 hover:border-primary-200 hover:text-primary-600'
          "
          @click="selectDay(day.value)"
        >
          {{ day.label }}
          <span
            v-if="day.value === todayValue"
            class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
            :class="
              activeDay === day.value ? 'bg-white' : 'bg-primary-400'
            "
          />
        </button>

        <span class="!mx-1 h-5 w-px bg-surface-200" />

        <button
          v-for="filter in quickFilters"
          :key="filter.value"
          type="button"
          class="inline-flex cursor-pointer items-center !gap-1.5 rounded-full border !px-3 !py-1.5 text-xs font-medium transition-colors"
          :class="
            activeFilters.includes(filter.value)
              ? 'border-primary-200 bg-primary-50 text-primary-700'
              : 'border-surface-200 bg-white text-surface-500 hover:border-primary-200 hover:text-primary-600'
          "
          @click="toggleFilter(filter.value)"
        >
          <i :class="filter.icon" style="font-size: 0.65rem" />
          {{ filter.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { InputText, InputGroup, InputGroupAddon } from "primevue";
import { useRoomView } from "@/composables/useRoomView";
import { useActiveDay } from "@/composables/useActiveDay";
import { RoomView, DAYS, getTodayValue } from "@/constants";

defineProps<{ search: string }>();

const emit = defineEmits<{
  "update:search": [value: string];
}>();

const roomView = useRoomView();
const isHostedRooms = computed(() => roomView.value === RoomView.Host);

const quickFilters = [
  { label: "Open now", value: "open-now", icon: "fa-solid fa-bolt" },
  {
    label: "Has open slots",
    value: "open-slots",
    icon: "fa-solid fa-circle-check",
  },
  { label: "Top rated", value: "top-rated", icon: "fa-solid fa-star" },
];

const todayValue = getTodayValue();

const activeFilters = ref<string[]>([]);
const activeDay = useActiveDay();

const toggleFilter = (value: string) => {
  activeFilters.value = activeFilters.value.includes(value)
    ? activeFilters.value.filter((v: string) => v !== value)
    : [...activeFilters.value, value];
};

const selectDay = (value: string) => {
  activeDay.value = activeDay.value === value ? "" : value;
};
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
