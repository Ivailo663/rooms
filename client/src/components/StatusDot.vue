<template>
  <span v-if="ping" class="relative flex h-2 w-2">
    <span
      :class="[
        'absolute -inset-0.5 animate-ping rounded-full opacity-75',
        pingClass,
      ]"
    />
    <span :class="['relative inline-flex h-2 w-2 rounded-full', bgClass]" />
  </span>
  <span v-else :class="['h-2 w-2 rounded-full', bgClass]" />
</template>

<script setup lang="ts">
import { computed } from "vue";

type Color = "green" | "amber" | "gray";

const props = withDefaults(
  defineProps<{
    color?: Color;
    ping?: boolean;
  }>(),
  {
    color: "gray",
    ping: false,
  }
);

const colorMap: Record<Color, { bg: string; ping: string }> = {
  green: { bg: "bg-emerald-500", ping: "bg-emerald-400" },
  amber: { bg: "bg-amber-400", ping: "bg-amber-300" },
  gray: { bg: "bg-surface-300", ping: "bg-surface-200" },
};

const bgClass = computed(() => colorMap[props.color].bg);
const pingClass = computed(() => colorMap[props.color].ping);
</script>
