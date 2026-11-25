import { ref, shallowRef, watch, type ShallowRef } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import type { EmblaCarouselType } from "embla-carousel";

// Which tile sits in the middle of the carousel, and how far each one is from it.
// chosenSlotIndex is what the card shows (and what onChoose hears);
// centeredSlotIndex follows the finger so the highlight moves with the swipe,
// not after it.
export const useMiddleTile = (
  embla: Readonly<ShallowRef<EmblaCarouselType | undefined>>,
  initialIndex: number,
  onChoose: (index: number) => void
) => {
  const reducedMotion = usePreferredReducedMotion();
  const chosenSlotIndex = ref(initialIndex);
  const centeredSlotIndex = ref(initialIndex);
  // Each tile's signed distance from the middle, in tile spacings, capped at
  // ±1: negative to the left, positive to the right.
  const howFarFromMiddle = shallowRef<number[]>([]);

  // Embla's "select" only fires once a drag is released, so the centred tile
  // is read off the scroll position on every frame instead.
  const findMiddleTile = (api: EmblaCarouselType) => {
    const snaps = api.scrollSnapList();
    const spacing = snaps.length > 1 ? 1 / (snaps.length - 1) : 0;
    const progress = api.scrollProgress();
    let nearest = 0;
    let nearestGap = Infinity;
    howFarFromMiddle.value = snaps.map((snap, index) => {
      const offset = spacing ? (snap - progress) / spacing : 0;
      if (Math.abs(offset) < nearestGap) {
        nearestGap = Math.abs(offset);
        nearest = index;
      }
      return Math.max(-1, Math.min(1, offset));
    });
    centeredSlotIndex.value = nearest;
  };

  watch(
    embla,
    (api) => {
      if (!api) return;
      const update = () => findMiddleTile(api);
      api
        .on("scroll", update)
        .on("reInit", update)
        .on("settle", () => {
          const index = api.selectedScrollSnap();
          if (index === chosenSlotIndex.value) return;
          chosenSlotIndex.value = index;
          onChoose(index);
        });
      update();
    },
    { immediate: true }
  );

  // Taps and arrow keys move the strip; the choice follows once it settles, so
  // every route to a tile goes through the same path as a swipe.
  const slideToSlot = (index: number) => {
    const api = embla.value;
    if (!api) return;
    const last = api.scrollSnapList().length - 1;
    api.scrollTo(
      Math.min(Math.max(index, 0), last),
      reducedMotion.value === "reduce"
    );
  };

  return { chosenSlotIndex, centeredSlotIndex, howFarFromMiddle, slideToSlot };
};
