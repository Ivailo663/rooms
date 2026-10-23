<template>
  <div class="!mb-6">
    <div class="flex flex-col items-center">
      <!-- Title -->
      <h1
        class="text-2xl font-bold tracking-tight text-surface-900 sm:text-3xl"
      >
        {{ isHostedRooms ? "Your Rooms" : undefined }}
      </h1>
      <p class="text-sm text-surface-400 !mt-1">
        {{
          isHostedRooms ? "Manage and configure your hosted rooms" : undefined
        }}
      </p>

      <!-- Unified search + day bar -->
      <div
        v-if="!isHostedRooms"
        class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-surface-200/40 shadow-sm transition-all focus-within:shadow-md focus-within:border-primary-300/50"
      >
        <!-- Mobile-only toggle for the search + filters panel -->
        <Button
          type="button"
          size="small"
          variant="text"
          severity="secondary"
          rounded
          :aria-label="panelOpen ? 'Hide search and filters' : 'Search rooms'"
          :aria-expanded="panelOpen"
          aria-controls="rooms-search-panel"
          class="!absolute !right-1.5 !top-1.5 !z-10 !h-8 !w-8 !p-0 sm:!hidden"
          @click="togglePanel"
        >
          <i
            :class="
              panelOpen
                ? 'fa-solid fa-xmark'
                : 'fa-solid fa-magnifying-glass text-surface-400'
            "
            style="font-size: 0.8rem"
          />
          <span
            v-if="!panelOpen && hasActiveQuery"
            class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-500"
          />
        </Button>

        <!-- Search row -->
        <div
          id="rooms-search-panel"
          class="items-center"
          :class="panelOpen ? 'flex' : 'hidden sm:flex'"
        >
          <i
            class="fa-solid fa-magnifying-glass !ml-4 text-surface-300"
            style="font-size: 0.75rem"
          />
          <InputText
            ref="searchInput"
            :model-value="search"
            placeholder="Search rooms..."
            class="flex-1 !bg-transparent !border-none !shadow-none !outline-none !py-3 !px-3 !text-sm !text-surface-700 placeholder:!text-surface-300"
            @update:model-value="emit('update:search', $event ?? '')"
          />
          <div
            class="flex items-center !gap-1.5 !mr-11 sm:!mr-3 rounded-lg bg-primary-50/60 !px-2 !py-1"
          >
            <i
              class="fa-solid fa-wand-magic-sparkles text-primary-400"
              style="font-size: 0.55rem"
            />
            <span class="text-xs font-medium text-primary-500">AI</span>
          </div>
        </div>

        <!-- Day selector row -->
        <div
          :class="`flex flex-wrap justify-center ${panelOpen ? '!mb-2' : undefined} md:!mb-0 px-2`"
        >
          <div
            class="flex items-center justify-center !gap-0.5 border-surface-100/50 !py-1.5"
            :class="
              panelOpen
                ? 'border-t !px-1 sm:!px-3'
                : 'border-t-0 sm:border-t !pl-1 sm:!px-3'
            "
          >
            <Button
              v-for="day in DAYS"
              :key="day.value"
              type="button"
              size="small"
              :variant="activeDay === day.value ? undefined : 'text'"
              :severity="activeDay === day.value ? undefined : 'secondary'"
              :aria-pressed="activeDay === day.value"
              :aria-label="day.full"
              class="!relative !h-7 !w-7 sm:!w-9 !p-0 !rounded-lg !border-none !text-xs !font-semibold"
              @click="selectDay(day.value)"
            >
              {{ day.label }}
              <span
                v-if="day.value === todayValue"
                class="absolute right-1 top-0.5 h-1 w-1 rounded-full"
                :class="activeDay === day.value ? 'bg-white' : 'bg-primary-400'"
              />
            </Button>
          </div>

          <!-- Quick filters -->
          <div
            v-if="!isHostedRooms"
            class="flex-wrap items-center justify-center !gap-2"
            :class="panelOpen ? 'flex' : 'hidden sm:flex'"
          >
            <Button
              v-for="filter in quickFilters"
              :key="filter.value"
              type="button"
              size="small"
              variant="outlined"
              :severity="
                activeFilters.includes(filter.value) ? undefined : 'secondary'
              "
              :aria-pressed="activeFilters.includes(filter.value)"
              class="!gap-1.5 !rounded-xl !px-3 !py-1 !text-xs !font-medium"
              :class="
                activeFilters.includes(filter.value)
                  ? '!bg-primary-50 shadow-sm'
                  : '!bg-white/60 backdrop-blur-sm'
              "
              @click="toggleFilter(filter.value)"
            >
              <i :class="filter.icon" style="font-size: 0.6rem" />
              {{ filter.label }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { Button, InputText } from "primevue";
import { useRoomView } from "@/composables/useRoomView";
import { useActiveDay } from "@/composables/useActiveDay";
import { RoomView, DAYS, getTodayValue } from "@/constants";

const props = defineProps<{ search: string }>();

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

// Below `sm` the search field and quick filters collapse behind the magnifier
// button so the week strip is the only thing on screen. From `sm` up both rows
// are always laid out and this flag is ignored.
const panelOpen = ref(false);
const searchInput = useTemplateRef<{ $el: HTMLInputElement }>("searchInput");

// A collapsed panel can still be filtering the list, so the button carries a
// dot whenever there is something hidden behind it.
const hasActiveQuery = computed(
  () => props.search.trim().length > 0 || activeFilters.value.length > 0
);

const togglePanel = async () => {
  panelOpen.value = !panelOpen.value;
  if (!panelOpen.value) return;

  await nextTick();
  searchInput.value?.$el.focus();
};

const toggleFilter = (value: string) => {
  activeFilters.value = activeFilters.value.includes(value)
    ? activeFilters.value.filter((v: string) => v !== value)
    : [...activeFilters.value, value];
};

const selectDay = (value: string) => {
  activeDay.value = activeDay.value === value ? "" : value;
};
</script>
