<template>
  <!-- Teleported and fixed-positioned: the room card that owns the avatars
       clips its overflow, so an in-flow overlay would be cut off. -->
  <Teleport to="body">
    <div
      ref="cardEl"
      class="fixed z-50 w-56 rounded-2xl border border-surface-200 bg-white !p-4 shadow-xl transition-opacity"
      :style="style"
      @mouseenter="emit('hold')"
      @mouseleave="emit('close')"
    >
      <!-- Picture, top middle -->
      <div class="flex justify-center">
        <div
          class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-primary-100 text-lg font-bold text-primary-600 shadow-sm"
        >
          {{ initials }}
        </div>
      </div>

      <!-- Name + rating -->
      <div class="!mt-2.5 text-center">
        <p class="truncate text-sm font-semibold text-surface-900">
          {{ name }}
        </p>
        <p
          class="!mt-0.5 flex items-center justify-center !gap-1 text-xs font-semibold text-amber-500"
        >
          <i class="fa-solid fa-star" style="font-size: 0.6rem" />
          {{ RATING.score }}
          <span class="font-normal text-surface-400">
            ({{ RATING.count }})
          </span>
        </p>
      </div>

      <!-- Placeholder detail rows — shape stays, values get wired up later. -->
      <dl class="!mt-3 flex flex-col !gap-1.5 border-t border-surface-100 !pt-3">
        <div
          v-for="detail in DETAILS"
          :key="detail.label"
          class="flex items-center justify-between !gap-2"
        >
          <dt class="text-[11px] text-surface-400">
            {{ detail.label }}
          </dt>
          <dd class="truncate text-[11px] font-medium text-surface-700">
            {{ detail.value }}
          </dd>
        </div>
      </dl>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  // Only the name comes in: the rest of the profile has no source yet, so
  // there is nothing for an id to fetch. When a player-details endpoint
  // exists, this takes the player's id and queries by it instead.
  name: string;
  // The avatar the card points at — read for its position only.
  anchor: HTMLElement;
}>();

const emit = defineEmits<{
  // Pointer entered the card itself: whoever opened it should keep it open.
  hold: [];
  close: [];
}>();

// Hardcoded until players carry a picture, rating and profile of their own.
const RATING = { score: "4.6", count: 23 };
const DETAILS = [
  { label: "Position", value: "Midfielder" },
  { label: "Games played", value: "24" },
  { label: "Attendance", value: "92%" },
  { label: "Member since", value: "Mar 2025" },
];

// Gap between avatar and card, and the margin kept to the viewport edges.
const GAP = 10;
const MARGIN = 8;

const cardEl = ref<HTMLElement | null>(null);
const pos = ref<{ top: number; left: number } | null>(null);

const initials = computed(
  () =>
    props.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
);

// Hidden rather than unmounted while unplaced: the card has to be in the DOM to
// be measured, and a visible one would flash at the top-left corner first.
const style = computed(() =>
  pos.value
    ? { top: `${pos.value.top}px`, left: `${pos.value.left}px` }
    : { top: "0px", left: "0px", opacity: "0" }
);

const place = () => {
  const el = cardEl.value;
  if (!el) return;
  const anchor = props.anchor.getBoundingClientRect();
  const card = el.getBoundingClientRect();

  // Below the avatar by default, flipped above when the card wouldn't fit.
  const below = anchor.bottom + GAP;
  const fitsBelow = below + card.height + MARGIN <= window.innerHeight;
  const top = fitsBelow
    ? below
    : Math.max(MARGIN, anchor.top - GAP - card.height);

  // Centred on the avatar, then pulled back inside the viewport.
  const centered = anchor.left + anchor.width / 2 - card.width / 2;
  const left = Math.min(
    Math.max(MARGIN, centered),
    Math.max(MARGIN, window.innerWidth - card.width - MARGIN)
  );

  pos.value = { top, left };
};

// A scroll or resize moves the avatar out from under the card; closing beats
// chasing it, since the pointer has left the avatar by then anyway.
const closeOnViewportChange = () => emit("close");

onMounted(() => {
  place();
  window.addEventListener("scroll", closeOnViewportChange, true);
  window.addEventListener("resize", closeOnViewportChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", closeOnViewportChange, true);
  window.removeEventListener("resize", closeOnViewportChange);
});

// Moving between two avatars reuses this card, so it has to re-place itself —
// after the new name has rendered, since that is what sets the card's height.
watch([() => props.anchor, () => props.name], place, { flush: "post" });
</script>