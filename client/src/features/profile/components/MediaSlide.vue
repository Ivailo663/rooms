<template>
  <div
    class="relative h-full w-full snap-start snap-always overflow-hidden"
    role="group"
    aria-roledescription="slide"
    :aria-label="label"
    data-media-slide
  >
    <template v-if="near">
      <!-- The grid already loaded the small copy (a clip's still), so it
           paints at once, blurred so it reads as "coming" rather than as a
           bad picture; the full photo or the playing clip fades in over it
           at the same size. The blur spills past the edges, so it fades out
           once the real thing is in. -->
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

      <!-- PROF-73. Inline, so iOS doesn't take it to its own full screen.
           Only the clip on screen downloads; its neighbours read just enough
           to start at once when swiped to. -->
      <video
        v-else-if="item.kind === 'video' && fullUrl && !broken"
        ref="video"
        :src="fullUrl"
        :preload="active ? 'auto' : 'metadata'"
        :muted="muted"
        loop
        playsinline
        disablepictureinpicture
        aria-label="Clip"
        class="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-200"
        :class="{ 'opacity-100': loaded }"
        data-clip
        @playing="loaded = true"
        @error="broken = true"
      />

      <div
        v-else-if="broken || isError"
        class="absolute inset-0 flex items-center justify-center"
      >
        <i
          class="fa-solid text-3xl text-white/40"
          :class="item.kind === 'video' ? 'fa-film' : 'fa-image'"
          aria-hidden="true"
        />
        <span class="sr-only">
          {{ item.kind === "video" ? "Clip" : "Photo" }} couldn't be shown
        </span>
      </div>

      <!-- PROF-73: a tap anywhere on the clip mutes or unmutes it. A real
           button, so it's a tap on a phone and Enter or Space on a keyboard;
           a swipe that starts on it still scrolls the feed. -->
      <button
        v-if="item.kind === 'video' && active && !broken"
        type="button"
        class="absolute inset-0 h-full w-full outline-none"
        :aria-label="muted ? 'Unmute' : 'Mute'"
        data-toggle-mute
        @click="toggleMute"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import type { MediaItem } from "@football/shared";
import { useMediaUrl } from "../composables/queries";

const props = defineProps<{
  item: MediaItem;
  // The one on screen and its neighbours; the rest of the feed stays empty,
  // so a long list doesn't download every full photo the moment it opens.
  near: boolean;
  // The one the feed has come to rest on: a clip plays only while it is.
  active: boolean;
  muted: boolean;
  label: string;
}>();

const emit = defineEmits<{
  toggleMute: [];
  // The browser refused to start the clip with sound.
  soundBlocked: [];
}>();

// Both URLs come from the same per-path cache as the grid's.
const { data: smallUrl } = useMediaUrl(
  () => props.item.poster_path ?? props.item.path,
  { enabled: computed(() => props.near) }
);
const { data: fullUrl, isError } = useMediaUrl(() => props.item.path, {
  enabled: computed(() => props.near),
});

const loaded = ref(false);
const broken = ref(false);

const video = useTemplateRef<HTMLVideoElement>("video");

// Browsers only start a clip with sound right after a tap. Opening the
// viewer is one, but the clip's URL arrives a moment later and swiping
// doesn't count, so a refusal falls back to playing muted; the viewer then
// shows it's muted, and the next tap unmutes.
const play = async (el: HTMLVideoElement) => {
  try {
    await el.play();
  } catch (error) {
    if ((error as DOMException)?.name !== "NotAllowedError" || el.muted) {
      return;
    }
    el.muted = true;
    emit("soundBlocked");
    await el.play().catch(() => {});
  }
};

// Set on the element inside the tap itself, as unmuting counts as playing
// with sound only while the tap is fresh. A clip the phone wouldn't start at
// all (iOS low power mode) starts here.
const toggleMute = () => {
  const el = video.value;
  if (el) {
    el.muted = !props.muted;
    if (el.paused) void play(el);
  }
  emit("toggleMute");
};

// Swiped away, a clip stops and goes back to its start, so it's heard from
// the top when it comes round again.
watch(
  [video, () => props.active],
  ([el, active]) => {
    if (!el) return;
    if (active) {
      el.muted = props.muted;
      void play(el);
    } else {
      el.pause();
      el.currentTime = 0;
    }
  },
  { flush: "post" }
);
</script>
