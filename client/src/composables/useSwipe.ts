import {
  onBeforeUnmount,
  onMounted,
  toValue,
  type MaybeRefOrGetter,
} from "vue";

type Point = { x: number; y: number };

type SwipeOptions = {
  /** Swipes are ignored entirely while this is false. */
  enabled?: MaybeRefOrGetter<boolean>;
  /** Minimum horizontal travel, in px, before a drag counts as a swipe. */
  threshold?: number;
  /**
   * Decides whether a touch starting here is a candidate at all — a screen
   * edge zone, an open drawer's own width, one region of a view. Without it,
   * a drag starting anywhere counts.
   */
  canStart?: (point: Point) => boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

/**
 * Horizontal swipe detection on the window, from the start and end points
 * only: the caller moves its own UI, so there's no need to follow the finger
 * and nothing to fight the page's vertical scrolling. Listeners are passive.
 *
 * Each call registers its own pair of listeners, so several components can
 * watch for their own swipes at once without coordinating.
 */
export const useSwipe = ({
  enabled = true,
  threshold = 50,
  canStart,
  onSwipeLeft,
  onSwipeRight,
}: SwipeOptions) => {
  let start: Point | null = null;

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    start = null;
    if (!toValue(enabled) || !touch) return;

    const point = { x: touch.clientX, y: touch.clientY };
    if (canStart && !canStart(point)) return;
    start = point;
  };

  const onTouchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    start = null;

    // Travelling further vertically than horizontally reads as a scroll.
    if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) return;

    if (dx > 0) onSwipeRight?.();
    else onSwipeLeft?.();
  };

  const onTouchCancel = () => {
    start = null;
  };

  onMounted(() => {
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchCancel);
  });
};
