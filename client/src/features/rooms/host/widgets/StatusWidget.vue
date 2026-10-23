<template>
  <div class="rounded-lg border !p-3" :class="TILE_STYLES[status]">
    <StatusBadge :status="status" class="!mb-2">
      <template v-if="status === 'live'" #adornment> {{ elapsed }}' </template>
    </StatusBadge>

    <div v-if="label" class="flex items-baseline !gap-1.5">
      <span class="text-lg font-bold text-surface-900">{{ label }}</span>
      <!-- Only a slot that hasn't started counts down to anything. -->
      <span
        v-if="status !== 'live' && countdown"
        class="text-xs text-surface-400"
      >
        {{ countdown }}
      </span>
    </div>

    <p v-if="hint" class="!mt-1.5 text-[10px] text-surface-400">{{ hint }}</p>
    <p v-else-if="!label" class="text-sm font-medium text-surface-300">
      No slots
    </p>
  </div>
</template>

<script setup lang="ts">
import StatusBadge, { type SlotStatusKind } from "@/components/StatusBadge.vue";

withDefaults(
  defineProps<{
    status: SlotStatusKind;
    // The slot this tile is about — live, next up, or the one that failed.
    label?: string | null;
    // Sits under the label: when the slot is, or why there isn't a time.
    hint?: string;
    // Minutes since kick-off, shown only while live.
    elapsed?: number;
    countdown?: string;
  }>(),
  { label: null, hint: "", elapsed: 0, countdown: "" }
);

// The badge carries the status colour; the tile repeats it as a wash behind it.
const TILE_STYLES: Record<SlotStatusKind, string> = {
  live: "border-emerald-100 bg-emerald-50/50",
  scheduled: "border-amber-100 bg-amber-50/50",
  redistributed: "border-violet-100 bg-violet-50/50",
  failed: "border-rose-100 bg-rose-50/50",
  inactive: "border-surface-100 bg-surface-50",
};
</script>
