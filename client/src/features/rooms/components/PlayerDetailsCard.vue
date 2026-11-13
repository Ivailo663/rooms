<template>
  <!-- Teleported and fixed-positioned: the room card that owns the avatars
       clips its overflow, so an in-flow overlay would be cut off. The z-index
       clears PrimeVue's modal layer (masks start at 1100 and count up), since
       avatars also live inside the Manage drawer. -->
  <Teleport to="body">
    <div
      ref="cardEl"
      data-player-details-card
      class="fixed z-[1200] w-56 rounded-2xl border border-surface-200 bg-white !p-4 shadow-xl transition-opacity"
      :style="style"
      @mouseenter="emit('hold')"
      @mouseleave="emit('close')"
    >
      <!-- Picture, top middle -->
      <div class="flex justify-center">
        <PlayerAvatar
          :name="name"
          :picture-url="profile?.picture_url"
          class="h-16 w-16 border-2 border-white text-lg shadow-sm"
        />
      </div>

      <p
        class="!mt-2.5 truncate text-center text-sm font-semibold text-surface-900"
      >
        {{ name }}
      </p>

      <!-- PROF-10/11: the rows keep their height while loading, so the card
           doesn't grow under the pointer once the profile arrives. -->
      <p
        v-if="isError"
        class="!mt-3 border-t border-surface-100 !pt-3 text-center text-[11px] text-surface-400"
        data-details-error
      >
        Couldn't load this player's details.
      </p>
      <dl
        v-else
        class="!mt-3 flex flex-col !gap-1.5 border-t border-surface-100 !pt-3"
        :aria-busy="isPending"
      >
        <div
          v-for="detail in details"
          :key="detail.label"
          class="flex items-center justify-between !gap-2"
        >
          <dt class="text-[11px] text-surface-400">
            {{ detail.label }}
          </dt>
          <dd
            v-if="isPending"
            class="h-3 w-14 animate-pulse rounded bg-surface-100"
          />
          <dd
            v-else
            class="truncate text-[11px] font-medium"
            :class="detail.value ? 'text-surface-700' : 'text-surface-300'"
          >
            {{ detail.value ?? "Not set" }}
          </dd>
        </div>
      </dl>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import PlayerAvatar from "@/components/PlayerAvatar.vue";
import { useGetPlayer } from "@/features/profile/composables/queries";
import {
  memberSince,
  positionLabel,
} from "@/features/profile/composables/profileRules";

const props = defineProps<{
  playerId: number;
  // The roster already knows the name, so it shows at once; everything else
  // comes from the player's profile (PROF-11).
  name: string;
  // The avatar the card points at — read for its position only.
  anchor: HTMLElement;
}>();

const emit = defineEmits<{
  // Pointer entered the card itself: whoever opened it should keep it open.
  hold: [];
  close: [];
}>();

const {
  data: profile,
  isPending,
  isError,
} = useGetPlayer(() => props.playerId);

// PROF-10. Never the email (PROF-32): the profile doesn't carry one.
const details = computed(() => [
  { label: "Position", value: positionLabel(profile.value?.position ?? null) },
  { label: "City", value: profile.value?.city ?? null },
  {
    label: "Member since",
    value: profile.value ? memberSince(profile.value.created_at) : null,
  },
]);

// Gap between avatar and card, and the margin kept to the viewport edges.
const GAP = 10;
const MARGIN = 8;

const cardEl = ref<HTMLElement | null>(null);
const pos = ref<{ top: number; left: number } | null>(null);

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
// A failed load swaps the rows for one line, which changes it too.
watch([() => props.anchor, () => props.name, isError], place, {
  flush: "post",
});
</script>
