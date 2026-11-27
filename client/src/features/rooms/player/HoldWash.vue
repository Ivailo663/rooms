<template>
  <!-- The hold's progress, shared by the centred tile (CARD-33, CARD-34) and
       the hub card (CARD-35). It stays up after the hold completes, until the
       action has landed. Join is a wash rising through the parent; leave
       fades the parent's content away. The parent must be
       positioned, rounded and its own stacking context (`relative isolate`). -->
  <span
    class="hold-wash pointer-events-none absolute"
    :class="[`hold-wash--${action}`, { 'hold-wash--active': active }]"
    :data-hold-wash="action"
    aria-hidden="true"
  >
    <!-- Leave: as the card fades, this comes up in its place, riding the
         veil's own opacity. Hidden from assistive tech: the button's label
         already says what the hold does. -->
    <span
      v-if="action === 'leave'"
      class="text-xs font-bold uppercase tracking-[0.1em] !mb-2 block"
    >
      Leaving game
    </span>

    <span v-if="action === 'leave' && !committed" class="text-xs">
      (Keep holding)
    </span>
    <span
      v-else-if="action === 'leave'"
      class="flex items-center !gap-1.5 text-xs"
    >
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 0.7rem" />
      Leaving…
    </span>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  // Join rises emerald from the bottom; leave fades the card out.
  action: "join" | "leave";
  // The press is down, or its action is still landing: grow over the hold's
  // full second and stay full.
  active: boolean;
  // The full second was held and the action is on its way: the leave veil
  // swaps "(Keep holding)" for a spinner and "Leaving…".
  committed?: boolean;
}>();
</script>

<style scoped>
/* ---- Join ------------------------------------------------------------------
   The joined wash's emerald (CARD-41), a shade darker and stronger, rising
   from the bottom behind the content (z -1), soft at its top edge. */
.hold-wash--join {
  inset: 0;
  z-index: -1;
  transform: scaleY(0);
  transform-origin: bottom;
  /* Letting go drops it back quickly. */
  transition: transform 180ms ease-out;
  background: linear-gradient(
    to top,
    rgba(5, 150, 105, 0.3) 0%,
    rgba(5, 150, 105, 0.14) 55%,
    rgba(5, 150, 105, 0) 100%
  );
}
.hold-wash--join.hold-wash--active {
  transform: scaleY(1);
  /* Holding grows it over the full second. */
  transition: transform 1000ms cubic-bezier(0.4, 0, 0.6, 1);
}

/* ---- Leave -----------------------------------------------------------------
   The card fades away: a white veil over everything (above the tile's
   avatars at z-3) grows more opaque across the hold, so the content reads as
   leaving. A veil rather than the card's own opacity, because the carousel
   sets each tile's opacity per frame for its side fade. pointer-events-none
   keeps the press reaching the button underneath. */
.hold-wash--leave {
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: inherit;
  background: #ffffff;
  opacity: 0;
  transition: opacity 180ms ease-out;
}
.hold-wash--leave.hold-wash--active {
  opacity: 1;
  /* Front-loaded, so the fade is obvious from the first moment of the hold. */
  transition: opacity 1000ms cubic-bezier(0.2, 0.6, 0.4, 1);
}

/* Reduced motion: no travel. The wash just appears while the press is held,
   and the full second is still required. The fade isn't movement, so it
   stays. */
@media (prefers-reduced-motion: reduce) {
  .hold-wash--join,
  .hold-wash--join.hold-wash--active {
    transition: none;
  }
}
</style>
