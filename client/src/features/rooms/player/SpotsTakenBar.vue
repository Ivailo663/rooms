<template>
  <span
    v-if="segmented"
    class="flex !gap-[3px]"
    data-seat-bar
    aria-hidden="true"
  >
    <span
      v-for="seat in max"
      :key="seat"
      class="h-1.5 min-w-0 flex-1 rounded-full"
      :class="seat <= taken ? fillClass : openClass"
      :data-filled="seat <= taken"
    />
  </span>
  <span
    v-else
    class="h-1.5 w-full overflow-hidden rounded-full"
    :class="openClass"
    data-seat-bar
    aria-hidden="true"
  >
    <span
      class="block h-full rounded-full"
      :class="fillClass"
      :style="{ width: `${fillPercent}%` }"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  taken: number;
  max: number;
  // An open seat on the centred tile is a faint groove; on a side tile it is
  // flat.
  centered: boolean;
}>();

// Above this many seats the segments get too thin to read, so the bar goes
// continuous.
const MAX_SEGMENTS = 14;

const segmented = computed(() => props.max > 0 && props.max <= MAX_SEGMENTS);
const fillPercent = computed(() =>
  props.max ? Math.min(100, (props.taken / props.max) * 100) : 0
);
const fillClass = computed(() =>
  props.max && props.taken >= props.max ? "bg-surface-400" : "bg-emerald-500"
);
const openClass = computed(() =>
  props.centered ? "slot-seat--open" : "bg-surface-200"
);
</script>

<style scoped>
.slot-seat--open {
  background: rgba(0, 0, 0, 0.08);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06);
}
</style>
