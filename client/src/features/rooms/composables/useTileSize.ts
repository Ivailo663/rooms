import { computed, type Ref } from "vue";
import { useElementSize } from "@vueuse/core";
import { STRIP_PADDING_Y, TILE_WIDTH_SHARE, tileSizeFor } from "./tileSize";

// A tile is 86% of the carousel wide and as tall as it is inside its padding
// (CARD-10); the smaller of the two picks the size. Measured on the border box
// because the padding is part of what is taken off.
export const useTileSize = (
  carousel: Readonly<Ref<HTMLElement | undefined>>
) => {
  const { width, height } = useElementSize(carousel, undefined, {
    box: "border-box",
  });
  return computed(() =>
    tileSizeFor(
      Math.max(
        0,
        Math.floor(
          Math.min(
            width.value * TILE_WIDTH_SHARE,
            height.value - STRIP_PADDING_Y
          )
        )
      )
    )
  );
};
