<template>
  <!-- PROF-72: full-bleed on phones, so it runs edge to edge under the
       header like a feed does. -->
  <section
    ref="section"
    aria-label="Posts"
    class="!-mx-4 !mt-6 border-t border-surface-200 sm:!mx-0"
    :aria-busy="isPending"
    data-profile-grid
  >
    <div
      v-if="isError"
      class="flex flex-col items-center !gap-3 !px-4 !py-14 text-center"
    >
      <p class="text-sm text-surface-500">Couldn't load posts.</p>
      <Button
        label="Try again"
        size="small"
        severity="secondary"
        @click="refetch()"
      />
    </div>

    <!-- PROF-75: no prompt beyond this line, and no button in it. -->
    <div
      v-else-if="isEmpty"
      class="flex flex-col items-center !gap-3 !px-4 !py-14 text-center"
    >
      <i
        class="fa-solid fa-camera text-2xl text-surface-200"
        aria-hidden="true"
      />
      <p class="text-sm text-surface-400">
        {{ own ? "Add your first photo or clip" : "No posts yet" }}
      </p>
    </div>

    <ul v-else role="list" class="grid grid-cols-3 !gap-0.5 !pt-0.5">
      <!-- Uploads in flight come first: they're the newest. -->
      <li
        v-for="upload in uploads"
        :key="upload.key"
        class="relative aspect-square overflow-hidden bg-surface-100"
        data-pending-upload
      >
        <img
          v-if="upload.previewUrl"
          :src="upload.previewUrl"
          alt=""
          class="h-full w-full object-cover"
          :class="{ 'opacity-40': upload.error }"
        />
        <div
          v-if="upload.error"
          class="absolute inset-0 flex flex-col items-center justify-center !gap-1 bg-black/55 !p-2 text-center"
        >
          <p role="alert" class="text-xs leading-snug text-white">
            {{ upload.error }}
          </p>
          <Button
            label="Dismiss"
            size="small"
            text
            class="!text-white"
            data-dismiss-upload
            @click="emit('dismiss', upload.key)"
          />
        </div>
        <div
          v-else
          class="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/50"
          role="progressbar"
          aria-label="Uploading photo"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(upload.progress * 100)"
        >
          <div
            class="h-full rounded-full bg-white transition-[width] duration-200"
            :style="{ width: `${upload.progress * 100}%` }"
          />
        </div>
      </li>

      <template v-if="media">
        <li v-for="item in media" :key="item.id">
          <MediaTile :item="item" :player-id="playerId" :own="own" />
        </li>
      </template>
      <!-- First load: one row's worth of squares, so the grid has its
           shape before the list arrives. -->
      <template v-else>
        <li
          v-for="n in 3"
          :key="n"
          class="aspect-square animate-pulse bg-surface-100"
        />
      </template>
    </ul>

    <MediaViewer
      :open="viewerOpen"
      :items="media ?? []"
      :start-id="viewingId"
      :own="own"
      :player-id="playerId"
      @settle="showInViewer"
      @close="closeViewer"
      @hidden="returnToTile"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "primevue";
import MediaTile from "./MediaTile.vue";
import MediaViewer from "./MediaViewer.vue";
import { useGetPlayerMedia } from "../composables/queries";
import type { PendingUpload } from "../composables/useMediaUploads";

const props = defineProps<{
  playerId: number;
  own: boolean;
  uploads: PendingUpload[];
}>();

const emit = defineEmits<{ dismiss: [key: string] }>();

const {
  data: media,
  isPending,
  isError,
  refetch,
} = useGetPlayerMedia(() => props.playerId);

const isEmpty = computed(
  () => media.value?.length === 0 && props.uploads.length === 0
);

// PROF-73: the viewer lives in the URL (?media=<id>), so the browser's back,
// the edge swipe (NAV-11) and a shared link all work without extra wiring.
const route = useRoute();
const router = useRouter();
const section = useTemplateRef<HTMLElement>("section");

const viewingId = computed(() => {
  const id = Number(route.query.media);
  return Number.isInteger(id) && id > 0 ? id : null;
});
const viewerOpen = computed(
  () => viewingId.value !== null && !!media.value?.length
);

// Swiping replaces the address rather than adding to it, so one back always
// closes the viewer, however far the player swiped.
const showInViewer = (id: number) => {
  if (viewingId.value === null || id === viewingId.value) return;
  router.replace({ query: { ...route.query, media: id } });
};

// Opened from the grid, the entry before this one is the page without
// ?media: going back to it is closing. Opened from a link, there's no such
// entry, so drop ?media where we are instead of leaving the page.
const closeViewer = () => {
  const back = router.options.history.state.back;
  const previous = typeof back === "string" ? router.resolve(back) : null;
  if (previous?.path === route.path && previous.query.media === undefined) {
    router.back();
  } else {
    router.replace({ query: { ...route.query, media: undefined } });
  }
};

// The page behind never scrolled, so the grid is where it was; only if the
// player swiped to an item now off screen does it move, just enough to show
// it, and focus lands there for the keyboard.
const returnToTile = (id: number | undefined) => {
  const tile = section.value?.querySelector<HTMLElement>(
    `[data-media-id="${id}"]`
  );
  if (!tile) return;
  tile.scrollIntoView?.({ block: "nearest" });
  tile
    .querySelector<HTMLElement>("[data-open-media]")
    ?.focus({ preventScroll: true });
};
</script>
