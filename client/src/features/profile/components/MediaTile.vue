<template>
  <div
    ref="tile"
    class="relative aspect-square overflow-hidden bg-surface-100"
    :data-media-id="item.id"
    data-media-tile
  >
    <!-- PROF-73: opening is a navigation (?media=<id>), so back closes the
         viewer again, and a real link is what a screen reader expects. -->
    <RouterLink
      :to="{ query: { ...route.query, media: item.id } }"
      class="block h-full w-full"
      aria-label="Open photo"
      data-open-media
    >
      <!-- The square holds its place while the URL resolves and the image
           decodes, then the photo fades in over it. -->
      <img
        v-if="url && !broken"
        :src="url"
        alt=""
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover opacity-0 transition-opacity duration-300"
        :class="{ 'opacity-100': loaded }"
        @load="loaded = true"
        @error="broken = true"
      />
      <span
        v-else-if="broken || isError"
        class="flex h-full w-full items-center justify-center"
      >
        <i
          class="fa-solid fa-image text-xl text-surface-300"
          aria-hidden="true"
        />
        <span class="sr-only">Photo couldn't be shown</span>
      </span>
    </RouterLink>

    <MediaDelete v-if="own" :item="item" :player-id="playerId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useIntersectionObserver } from "@vueuse/core";
import type { MediaItem } from "@football/shared";
import MediaDelete from "./MediaDelete.vue";
import { useMediaUrl } from "../composables/queries";

const props = defineProps<{
  item: MediaItem;
  playerId: number;
  own: boolean;
}>();

const route = useRoute();

// A long grid shouldn't ask storage for every URL at once: a tile resolves
// its URL when it comes near the screen, and keeps it after.
const tile = useTemplateRef<HTMLElement>("tile");
const seen = ref(false);
const { isSupported, stop } = useIntersectionObserver(
  tile,
  ([entry]) => {
    if (!entry?.isIntersecting) return;
    seen.value = true;
    stop();
  },
  { rootMargin: "300px" }
);

// PROF-72: the 400px copy. Items from before it existed have none.
const { data: url, isError } = useMediaUrl(
  () => props.item.poster_path ?? props.item.path,
  {
    enabled: computed(() => seen.value || !isSupported.value),
  }
);

const loaded = ref(false);
// An older HEIC item only decodes in Safari; elsewhere, and for a file
// that's gone, the tile shows a plain picture mark instead of a broken image.
const broken = ref(false);
</script>
