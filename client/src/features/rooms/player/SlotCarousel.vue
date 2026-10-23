<template>
  <div class="flex flex-col !gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-surface-500">Available slots</span>
      <span class="text-xs tabular-nums text-surface-400">
        {{
          timeslots.length ? `${selectedIndex + 1} / ${timeslots.length}` : ""
        }}
      </span>
    </div>

    <div class="flex items-center !gap-2">
      <button
        class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-400 outline-none transition-all hover:border-surface-300 hover:text-surface-700 disabled:cursor-not-allowed disabled:opacity-30"
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
            class="flex w-full items-center justify-between rounded-xl border !px-4 !py-2.5"
            :class="
              currentMarker === 'joined'
                ? 'border-emerald-200 bg-emerald-50/70'
                : currentMarker === 'pending'
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-surface-200 bg-white'
            "
          >
            <span
              class="flex items-center !gap-2 text-lg font-bold tabular-nums tracking-tight"
              :class="
                currentMarker === 'joined'
                  ? 'text-emerald-700'
                  : 'text-surface-900'
              "
            >
              {{ current.label }}
              <i
                v-if="currentMarker === 'joined'"
                class="fa-solid fa-circle-check text-emerald-500"
                style="font-size: 0.7rem"
                title="You're in this slot"
              />
              <i
                v-else-if="currentMarker === 'pending'"
                class="fa-solid fa-user-clock text-amber-500"
                style="font-size: 0.7rem"
                title="Awaiting approval"
              />
            </span>
            <button
              class="flex cursor-pointer items-center !gap-2 rounded-lg border-none bg-surface-100 !px-3 !py-1.5 text-surface-500 outline-none transition-colors hover:bg-surface-200 hover:text-surface-700"
              title="See who's in"
              @click.stop="emit('teams')"
            >
              <i class="fa-solid fa-users" style="font-size: 0.55rem" />
              <span class="text-sm font-semibold tabular-nums">
                {{ currentTaken }}/{{ currentMax }}
              </span>
            </button>
          </div>
          <div
            v-else
            key="empty"
            class="flex w-full items-center justify-center rounded-xl border border-dashed border-surface-200 !py-4"
          >
            <span class="text-sm text-surface-300">No time slots</span>
          </div>
        </Transition>
      </div>

      <button
        class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-400 outline-none transition-all hover:border-surface-300 hover:text-surface-700 disabled:cursor-not-allowed disabled:opacity-30"
        :disabled="selectedIndex >= timeslots.length - 1"
        @click="go(1)"
      >
        <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem" />
      </button>
    </div>

    <!-- Position rail: how many slots this room runs, and which one is up -->
    <div v-if="timeslots.length > 1" class="flex items-center !gap-1.5">
      <button
        v-for="(slot, index) in timeslots"
        :key="slot.id"
        type="button"
        class="h-1 flex-1 cursor-pointer rounded-full border-none !p-0 outline-none transition-colors"
        :class="railClass(slot, index)"
        :title="slot.label"
        @click="jumpTo(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { PlayableRoomResponse } from "@football/shared";

type Slot = PlayableRoomResponse["timeslots"][number];
export type SlotMarker = "joined" | "pending";

const props = withDefaults(
  defineProps<{
    timeslots: Slot[];
    // Per-slot membership badges for the current user, keyed by slot id.
    markers?: Record<number, SlotMarker>;
    // Slot to land on when the carousel mounts (e.g. the user's joined slot).
    initialIndex?: number;
  }>(),
  { markers: () => ({}), initialIndex: 0 }
);
const emit = defineEmits<{ select: [index: number]; teams: [] }>();

const selectedIndex = ref(0);
const slideDirection = ref<1 | -1>(1);

const clampIndex = (index: number) =>
  Math.min(Math.max(index, 0), props.timeslots.length - 1);

onMounted(() => {
  if (props.timeslots.length > 0) {
    selectedIndex.value = clampIndex(props.initialIndex);
    emit("select", selectedIndex.value);
  }
});

const transitionName = computed(() =>
  slideDirection.value === 1 ? "slide-left" : "slide-right"
);

const current = computed<Slot | undefined>(
  () => props.timeslots[selectedIndex.value]
);

const currentMarker = computed<SlotMarker | undefined>(() =>
  current.value ? props.markers[current.value.id] : undefined
);

const currentTaken = computed(() => current.value?.players?.length ?? 0);
const currentMax = computed(() => current.value?.max_players ?? 0);

// The rail doubles as a legend: membership colours the segment even when that
// slot isn't the one on screen.
const railClass = (slot: Slot, index: number) => {
  const marker = props.markers[slot.id];
  if (marker === "joined") return "bg-emerald-400";
  if (marker === "pending") return "bg-amber-300";
  return index === selectedIndex.value ? "bg-surface-400" : "bg-surface-200";
};

const select = (next: number, direction: 1 | -1) => {
  slideDirection.value = direction;
  selectedIndex.value = next;
  emit("select", next);
};

const go = (direction: -1 | 1) => {
  const next = selectedIndex.value + direction;
  if (next >= 0 && next < props.timeslots.length) select(next, direction);
};

const jumpTo = (index: number) => {
  if (index !== selectedIndex.value) {
    select(index, index > selectedIndex.value ? 1 : -1);
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
