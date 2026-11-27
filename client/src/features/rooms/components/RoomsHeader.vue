<template>
  <!-- Host view: just the title -->
  <div v-if="isHostedRooms" class="flex flex-col items-center">
    <h1 class="text-xl! font-normal text-surface-900 sm:text-3xl mb-1">
      Your Rooms
    </h1>
    <p class="text-sm text-surface-400">
      Manage and configure your hosted rooms
    </p>
  </div>

  <!-- Play view: one island holding the days and, with a game, the way back to it (HEAD-01).
       The width is a length on both sides so it can transition: hugging, it's
       the day row (7 buttons plus their gaps) plus this box's left padding and
       border; with a game it's the deck's own width. `mx-auto` centres it in
       both states (HEAD-02), and matches the deck below, which is also
       42rem centred. -->
  <div
    v-else
    data-island
    class="relative mx-auto flex items-center justify-between overflow-hidden rounded-2xl border border-surface-200/40 bg-white/70 pl-1.5 shadow-sm backdrop-blur-xl transition-[width,box-shadow,border-color] duration-300 ease-out focus-within:border-primary-300/50 focus-within:shadow-md motion-reduce:transition-none"
    :class="
      hasGame
        ? 'w-[min(100%,42rem)]'
        : 'w-[calc(13rem+0.375rem+2px)] sm:w-[calc(16.5rem+0.375rem+2px)]'
    "
  >
    <!-- <div class="flex items-center">
          <i
            class="fa-solid fa-magnifying-glass !ml-4 text-surface-300"
            style="font-size: 0.75rem"
          />
          <InputText
            :model-value="search"
            placeholder="Search rooms..."
            class="flex-1 !bg-transparent !border-none !shadow-none !outline-none !py-3 !px-3 !text-sm !text-surface-700 placeholder:!text-surface-300"
            @update:model-value="emit('update:search', $event ?? '')"
          />
          <div
            class="flex items-center !gap-1.5 !mr-3 rounded-lg bg-primary-50/60 !px-2 !py-1"
          >
            <i
              class="fa-solid fa-wand-magic-sparkles text-primary-400"
              style="font-size: 0.55rem"
            />
            <span class="text-xs font-medium text-primary-500">AI</span>
          </div>
        </div> -->

    <!-- shrink-0 keeps the days one row at their own size while the island
           resizes around them (HEAD-04, HEAD-10) -->
    <div data-days class="flex shrink-0 items-center !gap-0.5">
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

    <Transition
      enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
      enter-from-class="opacity-0"
    >
      <ReturnToGameBar v-if="hasGame" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button } from "primevue";
import { useRoomView } from "@/composables/useRoomView";
import { useActiveDay } from "@/composables/useActiveDay";
import { RoomView, DAYS, getTodayValue } from "@/constants";
import ReturnToGameBar from "../player/ReturnToGameBar.vue";
import { useGameMode } from "../composables/useGameMode";

defineProps<{ search: string }>();

// const emit = defineEmits<{
//   "update:search": [value: string];
// }>();

const { hasGame } = useGameMode();

const roomView = useRoomView();
const isHostedRooms = computed(() => roomView.value === RoomView.Host);

// const quickFilters = [
//   { label: "Open now", value: "open-now", icon: "fa-solid fa-bolt" },
//   {
//     label: "Has open slots",
//     value: "open-slots",
//     icon: "fa-solid fa-circle-check",
//   },
//   { label: "Top rated", value: "top-rated", icon: "fa-solid fa-star" },
// ];

const todayValue = getTodayValue();

// const activeFilters = ref<string[]>([]);
const activeDay = useActiveDay();

// const toggleFilter = (value: string) => {
//   activeFilters.value = activeFilters.value.includes(value)
//     ? activeFilters.value.filter((v: string) => v !== value)
//     : [...activeFilters.value, value];
// };

const selectDay = (value: string) => {
  activeDay.value = activeDay.value === value ? "" : value;
};
</script>
