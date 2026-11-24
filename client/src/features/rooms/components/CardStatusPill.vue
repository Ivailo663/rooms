<template>
  <!-- Straddles the top edge of the nearest positioned ancestor. That ancestor
       must not clip (CARD-03, CARD-37): put the pill on an unclipped shell
       beside the card, not inside the card's overflow-hidden. -->
  <span
    class="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center !gap-1 whitespace-nowrap rounded-full border !px-2 !py-0.5 text-[0.6rem] font-bold uppercase leading-none tracking-widest"
    :class="STATUSES[status].tone"
  >
    <i :class="['fa-solid', STATUSES[status].icon]" style="font-size: 0.5rem" />
    {{ STATUSES[status].label }}
  </span>
</template>

<script setup lang="ts">
const STATUSES = {
  joined: {
    label: "You're in",
    icon: "fa-circle-check",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  requested: {
    label: "Requested",
    icon: "fa-user-clock",
    tone: "border-amber-200 bg-amber-50 text-amber-600",
  },
  off: {
    label: "Game off",
    icon: "fa-circle-xmark",
    tone: "border-rose-200 bg-rose-50 text-rose-600",
  },
} as const;

defineProps<{ status: keyof typeof STATUSES }>();
</script>
