<template>
  <div class="!mb-6">
    <div class="flex flex-col items-center">
      <!-- Title -->
      <h1
        class="text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl"
      >
        {{ isHostedRooms ? "Your Rooms" : "Discover" }}
      </h1>
      <p class="text-sm text-surface-400 !mt-1">
        {{
          isHostedRooms
            ? "Manage and configure your hosted rooms"
            : "Find your next game"
        }}
      </p>

      <!-- Unified search + day bar -->
      <div
        v-if="!isHostedRooms"
        class="w-full max-w-2xl !mt-5 overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-surface-200/40 shadow-sm transition-all focus-within:shadow-md focus-within:border-primary-300/50"
      >
        <!-- Search row -->
        <div class="flex items-center">
          <i
            class="fa-solid fa-magnifying-glass !ml-4 text-surface-300"
            style="font-size: 0.75rem"
          />
          <input
            :value="search"
            type="text"
            class="flex-1 bg-transparent !py-3 !px-3 text-sm text-surface-700 outline-none border-none placeholder:text-surface-300"
            placeholder="Search rooms..."
            @input="emit('update:search', ($event.target as HTMLInputElement).value)"
          >
          <div
            class="flex items-center !gap-1.5 !mr-3 rounded-lg bg-primary-50/60 !px-2 !py-1"
          >
            <i
              class="fa-solid fa-wand-magic-sparkles text-primary-400"
              style="font-size: 0.55rem"
            />
            <span class="text-xs font-medium text-primary-500">AI</span>
          </div>
        </div>

        <!-- Day selector row -->
        <div class="flex items-center justify-center !gap-0.5 border-t border-surface-100/50 !px-3 !py-1.5">
          <button
            v-for="day in DAYS"
            :key="day.value"
            type="button"
            class="relative flex h-7 w-9 cursor-pointer items-center justify-center rounded-lg border-none outline-none text-xs font-semibold transition-all"
            :class="
              activeDay === day.value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-transparent text-surface-400 hover:text-surface-600 hover:bg-surface-50'
            "
            @click="selectDay(day.value)"
          >
            {{ day.label }}
            <span
              v-if="day.value === todayValue"
              class="absolute right-1 top-0.5 h-1 w-1 rounded-full"
              :class="activeDay === day.value ? 'bg-white' : 'bg-primary-400'"
            />
          </button>
        </div>
      </div>

      <!-- Quick filters -->
      <div
        v-if="!isHostedRooms"
        class="!mt-3 flex flex-wrap items-center justify-center !gap-2"
      >
        <button
          v-for="filter in quickFilters"
          :key="filter.value"
          type="button"
          class="inline-flex cursor-pointer items-center !gap-1.5 rounded-xl border !px-3.5 !py-2 text-xs font-medium transition-all outline-none"
          :class="
            activeFilters.includes(filter.value)
              ? 'border-primary-300 bg-primary-50 text-primary-600 shadow-sm'
              : 'border-surface-200/60 bg-white/60 backdrop-blur-sm text-surface-500 hover:text-surface-700 hover:border-surface-300 hover:bg-white/80'
          "
          @click="toggleFilter(filter.value)"
        >
          <i :class="filter.icon" style="font-size: 0.6rem" />
          {{ filter.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
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
