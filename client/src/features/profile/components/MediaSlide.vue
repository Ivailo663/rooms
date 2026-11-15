<template>
  <div
    class="relative h-full w-full snap-start snap-always overflow-hidden"
    role="group"
    aria-roledescription="slide"
    :aria-label="label"
    data-media-slide
  >
    <template v-if="near">
      <!-- The grid already loaded the small copy, so it paints at once,
           blurred so it reads as "coming" rather than as a bad photo; the
           full copy fades in over it at the same size. The blur spills past
           the photo's edges, so it fades out once the full copy is in. -->
      <img
        v-if="smallUrl"
        :src="smallUrl"
        alt=""
        class="absolute inset-0 h-full w-full scale-105 object-contain blur-md transition-opacity delay-200 duration-200"
        :class="{ 'opacity-0': loaded }"
        data-small-copy
      />

      <img
        v-if="item.kind === 'photo' && fullUrl && !broken"
        :src="fullUrl"
        alt="Photo"
        decoding="async"
        class="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-200"
        :class="{ 'opacity-100': loaded }"
        data-full-copy
        @load="loaded = true"
        @error="broken = true"
      />

      <!-- Step 5 puts the player here, with sound and tap-to-mute. Until
           then a video shows its still frame and the play mark. -->
      <div
        v-else-if="item.kind === 'video'"
        class="absolute inset-0 flex items-center justify-center"
      >
        <i
          class="fa-solid fa-play text-4xl text-white/80 drop-shadow"
          aria-hidden="true"
        />
        <span class="sr-only">Video</span>
      </div>

      <div
        v-else-if="broken || isError"
        class="absolute inset-0 flex items-center justify-center"
      >
        <i
          class="fa-solid fa-image text-3xl text-white/40"
          aria-hidden="true"
        />
        <span class="sr-only">Photo couldn't be shown</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { MediaItem } from "@football/shared";
import { useMediaUrl } from "../composables/queries";

const props = defineProps<{
  item: MediaItem;
  // The one on screen and its neighbours; the rest of the feed stays empty,
  // so a long list doesn't download every full photo the moment it opens.
  near: boolean;
  label: string;
}>();

// Both URLs come from the same per-path cache as the grid's.
const { data: smallUrl } = useMediaUrl(
  () => props.item.poster_path ?? props.item.path,
  { enabled: computed(() => props.near) }
);
const { data: fullUrl, isError } = useMediaUrl(() => props.item.path, {
  enabled: computed(() => props.near && props.item.kind === "photo"),
});

const loaded = ref(false);
const broken = ref(false);
</script>
