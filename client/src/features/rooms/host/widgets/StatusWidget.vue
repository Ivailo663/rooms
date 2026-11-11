<template>
  <section
    class="overflow-hidden rounded-lg border bg-white"
    :class="PANEL_BORDERS[status]"
  >
    <header
      class="bg-linear-to-b to-white !p-3"
      :class="HEADER_WASHES[status]"
      data-panel-header
    >
      <StatusBadge :status="status" class="!mb-2">
        <template v-if="status === 'live'" #adornment>
          {{ elapsed }}'
        </template>
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

      <p
        v-if="hint && !hintTrails"
        class="!mt-1.5 text-[10px] text-surface-400"
      >
        {{ hint }}
      </p>
      <p v-else-if="!label" class="text-sm font-medium text-surface-300">
        No slots
      </p>
    </header>

    <div
      v-if="$slots.default || hintTrails"
      class="flex flex-col !gap-2 !px-3 !pb-3"
      data-panel-body
    >
      <slot />
      <p v-if="hintTrails" class="text-[10px] text-surface-400" data-panel-hint>
        {{ hint }}
      </p>
    </div>
  </section>
</template>

<script lang="ts">
import type { SlotStatusKind } from "@/components/StatusBadge.vue";

// Failed and redistributed slots have their own notices, so the panel only
// ever says what's live, what's next, or that there's nothing.
export type PanelStatus = Extract<
  SlotStatusKind,
  "live" | "scheduled" | "inactive"
>;
</script>

<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "@/components/StatusBadge.vue";

const props = withDefaults(
  defineProps<{
    status: PanelStatus;
    // The slot this panel is about — live or next up.
    label?: string | null;
    // When the slot is, or why there isn't a time. While live it previews the
    // slot after this one instead.
    hint?: string;
    // Minutes since kick-off, shown only while live.
    elapsed?: number;
    countdown?: string;
  }>(),
  { label: null, hint: "", elapsed: 0, countdown: "" }
);

// A live hint is about the following slot, not this one, so it closes the
// panel instead of reading as part of the header.
const hintTrails = computed(() => props.status === "live" && !!props.hint);

// The badge carries the status colour; the header repeats it as a wash that
// has faded to white by its bottom edge, so the widgets below sit on white
// and keep their own colours.
const HEADER_WASHES: Record<PanelStatus, string> = {
  live: "from-emerald-50",
  scheduled: "from-amber-50",
  inactive: "from-surface-50",
};

const PANEL_BORDERS: Record<PanelStatus, string> = {
  live: "border-emerald-100",
  scheduled: "border-amber-100",
  inactive: "border-surface-100",
};
</script>
