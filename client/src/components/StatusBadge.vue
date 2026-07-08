<template>
  <div
    class="flex items-center !gap-1.5"
    :class="
      pill ? ['rounded-lg !px-2.5 !py-1.5', STATUS_STYLES[status].bg] : ''
    "
  >
    <StatusDot :color="STATUS_STYLES[status].dot" :ping="status === 'live'" />
    <span
      class="text-[10px] font-semibold uppercase tracking-widest"
      :class="STATUS_STYLES[status].text"
    >
      <slot>{{ DEFAULT_LABELS[status] }}</slot>
    </span>
    <span
      v-if="$slots.adornment"
      class="text-[10px] font-semibold italic"
      :class="STATUS_STYLES[status].text"
    >
      <slot name="adornment" />
    </span>
  </div>
</template>

<script setup lang="ts">
import StatusDot from "./StatusDot.vue";

export type SlotStatusKind = "live" | "scheduled" | "inactive";

withDefaults(
  defineProps<{
    status: SlotStatusKind;
    pill?: boolean;
  }>(),
  { pill: false }
);

const STATUS_STYLES: Record<
  SlotStatusKind,
  { dot: "green" | "amber" | "gray"; text: string; bg: string }
> = {
  live: { dot: "green", text: "text-emerald-600", bg: "bg-emerald-50" },
  scheduled: { dot: "amber", text: "text-amber-600", bg: "bg-amber-50" },
  inactive: { dot: "gray", text: "text-surface-400", bg: "bg-surface-50" },
};

const DEFAULT_LABELS: Record<SlotStatusKind, string> = {
  live: "Live",
  scheduled: "Scheduled",
  inactive: "Offline",
};
</script>
