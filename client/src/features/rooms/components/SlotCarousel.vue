<template>
  <div class="flex flex-col !gap-2">
    <p
      class="flex items-center text-xs font-semibold uppercase tracking-widest text-surface-400"
    >
      <i class="fa-solid fa-clock !mr-1" style="font-size: 0.6rem" />
      Available slots
      <span class="!ml-auto text-surface-300">
        {{ selectedIndex + 1 }} / {{ timeslots.length }}
      </span>
    </p>

    <div class="flex items-center !gap-2">
      <button
        class="flex h-7 w-7 !cursor-pointer shrink-0 items-center justify-center rounded-lg border border-surface-200 text-surface-400 transition-all hover:border-surface-300 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-30"
        :disabled="selectedIndex === 0"
        @click="go(-1)"
      >
        <i class="fa-solid fa-chevron-left" style="font-size: 0.6rem" />
      </button>

      <div class="relative flex flex-1 overflow-hidden">
        <Transition :name="transitionName" mode="out-in">
          <div
            v-if="current"
            :key="selectedIndex"
            class="flex w-full flex-col rounded-xl border border-primary-300 bg-primary-50 !px-3 !py-2 text-primary-700 shadow-sm"
          >
            <span class="block text-xs font-semibold">{{ current.label }}</span>
            <span class="flex items-center !gap-1 text-xs opacity-70">
              <i class="fa-solid fa-users" style="font-size: 0.55rem" />
              {{ spotsLeftLabel }}
            </span>
          </div>
          <span
            v-else
            :key="`empty`"
            class="text-xs italic text-surface-300 text-center block w-full"
            >No time slots</span
          >
        </Transition>
      </div>

      <button
        class="flex h-7 w-7 shrink-0 items-center !cursor-pointer justify-center rounded-lg border border-surface-200 text-surface-400 transition-all hover:border-surface-300 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-30"
        :disabled="selectedIndex >= timeslots.length - 1"
        @click="go(1)"
      >
        <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { PlayableRoomResponse } from "@football/shared";

type Slot = PlayableRoomResponse["timeslots"][number];

const props = defineProps<{ timeslots: Slot[] }>();
const emit = defineEmits<{ select: [index: number] }>();

const selectedIndex = ref(0);
const slideDirection = ref<1 | -1>(1);

onMounted(() => {
  if (props.timeslots.length > 0) emit("select", 0);
});
const transitionName = computed(() =>
  slideDirection.value === 1 ? "slide-left" : "slide-right"
);

const current = computed<Slot | undefined>(
  () => props.timeslots[selectedIndex.value]
);

const spotsLeftLabel = computed(() => {
  const slot = current.value;
  if (!slot) return "";
  const taken = slot.players?.length ?? 0;
  const max = slot.max_players ?? 0;
  return `${Math.max(0, max - taken)} spots left (${taken}/${max})`;
});

const go = (direction: -1 | 1) => {
  const next = selectedIndex.value + direction;
  if (next >= 0 && next < props.timeslots.length) {
    slideDirection.value = direction;
    selectedIndex.value = next;
    emit("select", next);
  }
};
</script>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.slide-left-enter-from {
  transform: translateX(16px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-16px);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-16px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(16px);
  opacity: 0;
}
</style>
