<template>
  <span class="flex items-center !gap-1.5">
    <span :class="[variant.text, gathered ? 'text-emerald-600' : variant.idle]">
      {{ count }}/{{ max }}
    </span>
    <i
      v-if="gathered"
      class="fa-solid fa-circle-check text-emerald-500"
      :style="{ fontSize: variant.icon }"
      :title="title"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Size = "sm" | "xs";

const props = withDefaults(
  defineProps<{
    count: number;
    max: number;
    gathered?: boolean;
    // Explains the check mark on hover — see `gatheredTitle`.
    title?: string;
    size?: Size;
  }>(),
  {
    gathered: false,
    title: undefined,
    size: "sm",
  }
);

const variants: Record<Size, { text: string; idle: string; icon: string }> = {
  sm: { text: "text-xs font-bold", idle: "text-surface-600", icon: "0.7rem" },
  xs: {
    text: "text-[10px] font-medium",
    idle: "text-surface-400",
    icon: "0.55rem",
  },
};

const variant = computed(() => variants[props.size]);
</script>
