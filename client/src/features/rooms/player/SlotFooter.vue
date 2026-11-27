<template>
  <div class="flex flex-col items-center text-center">
    <!-- The hold is the confirmation, so assistive tech gets it too: the
         description says how long, and the hint is announced when a short
         press is turned away. -->
    <template v-if="state === 'leave'">
      <button
        type="button"
        class="leave-button inline-flex min-h-11 cursor-pointer items-center justify-center !gap-2 rounded-full border-none bg-transparent !px-4 text-sm font-semibold text-rose-500 outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Leave game"
        :aria-describedby="descriptionId"
        :disabled="pending"
        v-on="hold.handlers"
      >
        <span aria-hidden="true"> Hold to leave </span>
      </button>
      <span :id="descriptionId" class="sr-only" role="status">
        Press and hold for one second to leave.
        <template v-if="hold.releasedEarly.value">Hold to leave</template>
      </span>
    </template>

    <span
      v-else-if="state === 'cantLeave' && label"
      class="flex items-center !gap-1.5 text-sm text-surface-400"
    >
      <i v-if="icon" :class="`fa-solid ${icon}`" style="font-size: 0.65rem" />
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useId, watch } from "vue";
import { useHoldPress } from "../composables/useHoldPress";

// The hub's leave action: the hub has no slot tile to hold, so it keeps this
// small footer (CARD-35). A game in the hub is one the player holds a seat in,
// so the only states are leaving and the reason they can't. Joining happens on
// the browse card's tile. The hold's wash runs over the whole hub card, so the
// footer only reports when the press is down (`holding`) and the hub draws it.
const props = defineProps<{
  state: "leave" | "cantLeave";
  pending?: boolean;
  label?: string;
  icon?: string;
}>();

const emit = defineEmits<{ leave: []; holding: [boolean] }>();

const descriptionId = useId();
const hold = useHoldPress({
  onHold: () => emit("leave"),
  enabled: () => props.state === "leave" && !props.pending,
});

watch(hold.holding, (holding) => emit("holding", holding));
</script>

<style scoped>
/* No long-press menu, text selection or iOS callout while the finger is down. */
.leave-button {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
</style>
