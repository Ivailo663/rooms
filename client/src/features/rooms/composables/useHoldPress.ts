import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { tryOnScopeDispose } from "@vueuse/core";

// Joining and leaving are a deliberate 1 s press, so a stray tap can't do
// either and no confirm step is needed (CARD-33, CARD-34, CARD-35).
export const HOLD_MS = 1000;
// How long "Keep holding…" shows after a press was let go too early.
export const RELEASED_EARLY_MS = 1800;
// A pointer that travels further sideways than this while pressed is swiping,
// not holding. Kept under Embla's 10px drag threshold, so the hold is dropped
// before the strip starts to move.
export const SWIPE_TOLERANCE_PX = 8;

type Options = {
  onHold: () => void;
  // Presses are ignored while false, and a hold in progress is dropped.
  enabled?: MaybeRefOrGetter<boolean>;
};

const isActivationKey = (event: KeyboardEvent) =>
  event.key === "Enter" || event.key === " ";

// A press that lands on a control nested inside the target (an avatar button
// in a tile) belongs to that control.
const fromNestedControl = (event: Event) => {
  const nested =
    event.target instanceof Element
      ? event.target.closest("button, a, [role='button']")
      : null;
  return nested !== null && nested !== event.currentTarget;
};

export const useHoldPress = ({ onHold, enabled = true }: Options) => {
  const holding = ref(false);
  const releasedEarly = ref(false);

  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let releasedEarlyTimer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;

  const start = () => {
    if (holding.value || !toValue(enabled)) return;
    holding.value = true;
    releasedEarly.value = false;
    holdTimer = setTimeout(() => {
      holding.value = false;
      holdTimer = undefined;
      onHold();
    }, HOLD_MS);
  };

  // Anything that ends the press before the timer fires abandons it silently.
  const cancel = () => {
    if (!holding.value) return;
    clearTimeout(holdTimer);
    holdTimer = undefined;
    holding.value = false;
  };

  // A release while the hold is still running is a tap or a short press:
  // nothing is sent, and the line says what is needed instead.
  const release = () => {
    if (!holding.value) return;
    cancel();
    releasedEarly.value = true;
    clearTimeout(releasedEarlyTimer);
    releasedEarlyTimer = setTimeout(
      () => (releasedEarly.value = false),
      RELEASED_EARLY_MS
    );
  };

  watch(
    () => toValue(enabled),
    (on) => {
      if (!on) cancel();
    }
  );

  tryOnScopeDispose(() => {
    clearTimeout(holdTimer);
    clearTimeout(releasedEarlyTimer);
  });

  // Bound with v-on="handlers". Pointer-leave and blur cancel without the
  // early-release message: the press didn't end, it was taken away.
  const handlers = {
    pointerdown: (event: PointerEvent) => {
      if (event.button !== 0 || fromNestedControl(event)) return;
      startX = event.clientX;
      start();
    },
    pointermove: (event: PointerEvent) => {
      if (
        holding.value &&
        Math.abs(event.clientX - startX) > SWIPE_TOLERANCE_PX
      ) {
        cancel();
      }
    },
    pointerup: release,
    pointercancel: cancel,
    pointerleave: cancel,
    blur: cancel,
    // No long-press menu while the finger is down.
    contextmenu: (event: Event) => {
      if (toValue(enabled)) event.preventDefault();
    },
    // preventDefault on both edges stops the browser's own click for
    // Enter/Space from bypassing the hold. Keys that bubble up from a nested
    // control are its own.
    keydown: (event: KeyboardEvent) => {
      if (!isActivationKey(event) || event.target !== event.currentTarget)
        return;
      event.preventDefault();
      if (event.repeat) return;
      start();
    },
    keyup: (event: KeyboardEvent) => {
      if (!isActivationKey(event) || event.target !== event.currentTarget)
        return;
      event.preventDefault();
      release();
    },
  };

  return { holding, releasedEarly, handlers };
};
