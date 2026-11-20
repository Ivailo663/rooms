<template>
  <div class="flex flex-col items-center text-center">
    <!-- The hold is the confirmation, so assistive tech gets it too: the
         description says how long, and the hint is announced when a short
         press is turned away. -->
    <template v-if="state === 'leave'">
      <button
        type="button"
        class="leave-button relative inline-flex min-h-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-none bg-transparent !px-4 !py-2.5 text-sm font-semibold text-rose-500 outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        :class="{ 'leave-button--holding': hold.holding.value }"
        aria-label="Leave game"
        :aria-describedby="descriptionId"
        :disabled="pending"
        v-on="hold.handlers"
      >
        <span
          class="leave-fill absolute inset-0 bg-rose-200"
          aria-hidden="true"
        />
        <span
          class="relative inline-flex items-center !gap-2"
          aria-hidden="true"
        >
          <i
            :class="
              pending
                ? 'fa-solid fa-spinner fa-spin'
                : 'fa-solid fa-right-from-bracket'
            "
            style="font-size: 0.65rem"
          />
          {{ hold.hint.value ? "Hold to leave" : "Leave game" }}
        </span>
      </button>
      <span :id="descriptionId" class="sr-only" role="status">
        Press and hold for one second to leave.
        <template v-if="hold.hint.value">Hold to leave</template>
      </span>
    </template>

    <span
      v-else-if="state === 'status' && label"
      class="flex items-center !gap-1.5 text-sm text-surface-400"
    >
      <i v-if="icon" :class="`fa-solid ${icon}`" style="font-size: 0.65rem" />
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useId } from "vue";
import { useHoldPress } from "../composables/useHoldPress";

// The hub's leave action: the hub has no slot tile to hold, so it keeps this
// small footer (CARD-35). A game in the hub is one the player holds a seat in,
// so the only states are leaving and the reason they can't. Joining happens on
// the browse card's tile.
const props = defineProps<{
  state: "leave" | "status";
  pending?: boolean;
  label?: string;
  icon?: string;
}>();

const emit = defineEmits<{ leave: [] }>();

const descriptionId = useId();
const hold = useHoldPress({
  onHold: () => emit("leave"),
  enabled: () => props.state === "leave" && !props.pending,
});
</script>

<style scoped>
/* No long-press menu, text selection or iOS callout while the finger is down. */
.leave-button {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}

.leave-fill {
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 150ms ease-out;
}

.leave-button--holding .leave-fill {
  transform: scaleX(1);
  transition: transform 1000ms linear;
}

/* No sweep for reduced motion: the fill just appears as a steady tint while
   the press is held, and the full second is still required. */
@media (prefers-reduced-motion: reduce) {
  .leave-fill {
    transform: scaleX(1);
    opacity: 0;
    transition: none;
  }

  .leave-button--holding .leave-fill {
    opacity: 0.6;
    transition: none;
  }
}
</style>
