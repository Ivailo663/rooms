<template>
  <div class="flex flex-col !gap-3">
    <div class="flex items-center justify-between">
      <span
        class="text-sm font-medium"
        :class="isGlass ? 'text-white/60' : 'text-surface-400'"
      >
        Available slots
      </span>
      <span
        class="text-sm tabular-nums"
        :class="isGlass ? 'text-white/40' : 'text-surface-300'"
      >
        {{ timeslots.length ? `${selectedIndex + 1} / ${timeslots.length}` : '' }}
      </span>
    </div>

    <div class="flex items-center !gap-2">
      <button
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none outline-none"
        :class="
          isGlass
            ? 'bg-white/10 text-white/60 hover:bg-white/20'
            : 'border border-surface-100 bg-white text-surface-400 hover:border-surface-200 hover:text-surface-600'
        "
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
            class="flex w-full items-center justify-between rounded-xl !px-5 !py-3"
            :class="
              isGlass
                ? 'bg-white/10'
                : 'border border-surface-100 bg-surface-50/50'
            "
          >
            <span
              class="text-base font-semibold"
              :class="isGlass ? 'text-white' : 'text-surface-800'"
            >
              {{ current.label }}
            </span>
            <button
              class="flex items-center !gap-2 rounded-lg !px-3 !py-1.5 transition-colors cursor-pointer border-none outline-none"
              :class="
                isGlass
                  ? 'bg-white/15 text-white/80 hover:bg-white/25'
                  : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
              "
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
            :key="`empty`"
            class="flex w-full items-center justify-center rounded-xl !py-4"
            :class="
              isGlass
                ? 'border border-white/10'
                : 'border border-dashed border-surface-200'
            "
          >
            <span
              class="text-sm"
              :class="isGlass ? 'text-white/30' : 'text-surface-300'"
            >
              No time slots
            </span>
          </div>
        </Transition>
      </div>

      <button
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none outline-none"
        :class="
          isGlass
            ? 'bg-white/10 text-white/60 hover:bg-white/20'
            : 'border border-surface-100 bg-white text-surface-400 hover:border-surface-200 hover:text-surface-600'
        "
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

const props = withDefaults(
  defineProps<{ timeslots: Slot[]; variant?: "default" | "glass" }>(),
  { variant: "default" }
);
const emit = defineEmits<{ select: [index: number]; teams: [] }>();

const isGlass = computed(() => props.variant === "glass");

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

const currentTaken = computed(() => current.value?.players?.length ?? 0);
const currentMax = computed(() => current.value?.max_players ?? 0);

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
