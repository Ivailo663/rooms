<template>
  <!-- PROF-73. A modal Dialog brings the focus trap, Escape, the stacking
       above the drawer and the page's scroll lock. -->
  <Dialog
    :visible="open"
    modal
    :draggable="false"
    class="!m-0 !h-dvh !max-h-none !w-screen !max-w-none !rounded-none !border-0 !bg-black !shadow-none"
    :pt="{ root: { 'aria-label': 'Posts' } }"
    @update:visible="(visible) => !visible && close()"
    @after-hide="emit('hidden', current?.id)"
  >
    <template #container>
      <!-- The drawer's swipes listen on the window (NAV-10); a touch in here
           stops before it, so a sideways drag can't open the drawer over the
           viewer. The left edge still passes, as it's "back" (NAV-11), which
           here closes the viewer. -->
      <div class="relative h-full w-full" @touchstart.passive="guardEdges">
        <!-- One item per screen, snapping like a feed. Native scroll-snap
             follows the finger and also answers the wheel and the arrow
             keys once focused. -->
        <div
          ref="scroller"
          tabindex="0"
          aria-label="Swipe up or down for the next or previous post"
          class="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none [scrollbar-width:none]"
          data-media-feed
          @scroll.passive="onScroll"
        >
          <MediaSlide
            v-for="(item, i) in items"
            :key="item.id"
            :item="item"
            :near="Math.abs(i - index) <= 1"
            :active="i === index && i === settledIndex"
            :muted="muted"
            :label="`${i + 1} of ${items.length}`"
            @toggle-mute="toggleMute"
            @sound-blocked="muted = true"
          />
        </div>

        <p class="sr-only" aria-live="polite">{{ position }}</p>

        <!-- PROF-73: the sound state of the clip on screen. A tap flashes
             the new state in the middle; muted also stays in the corner, so
             a clip the browser started silently says why it's quiet. -->
        <template v-if="current?.kind === 'video'">
          <Transition
            leave-active-class="transition duration-300"
            leave-to-class="opacity-0 scale-90"
          >
            <span
              v-if="flash"
              :key="flash"
              class="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
              aria-hidden="true"
              data-mute-flash
            >
              <i
                class="fa-solid text-2xl"
                :class="muted ? 'fa-volume-xmark' : 'fa-volume-high'"
              />
            </span>
          </Transition>
          <span
            v-if="muted"
            class="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
            data-muted
          >
            <i class="fa-solid fa-volume-xmark text-sm" aria-hidden="true" />
            <span class="sr-only">Muted</span>
          </span>
        </template>

        <button
          type="button"
          class="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] flex h-12 w-12 items-center justify-center text-white"
          aria-label="Close"
          data-close-viewer
          @click="close"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <i class="fa-solid fa-xmark text-lg" aria-hidden="true" />
          </span>
        </button>

        <MediaDelete
          v-if="own && current"
          :item="current"
          :player-id="playerId"
          size="viewer"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { Dialog } from "primevue";
import type { MediaItem } from "@football/shared";
import MediaSlide from "./MediaSlide.vue";
import MediaDelete from "./MediaDelete.vue";
import { backSwipeCanStart } from "@/composables/edgeGestures";

const props = defineProps<{
  open: boolean;
  items: MediaItem[];
  // Read when the viewer opens; after that, the feed's scroll decides.
  startId: number | null;
  own: boolean;
  playerId: number;
}>();

const emit = defineEmits<{
  close: [];
  // The item the feed came to rest on.
  settle: [id: number];
  // Gone from the screen, with the item it was last showing.
  hidden: [lastId: number | undefined];
}>();

const scroller = useTemplateRef<HTMLElement>("scroller");
const index = ref(0);
const current = computed(() => props.items[index.value]);
const position = computed(() =>
  props.items.length ? `${index.value + 1} of ${props.items.length}` : ""
);

// Where the feed last came to rest. A clip plays only there, so it doesn't
// start mid-swipe, and stops as soon as the swipe carries it away.
const settledIndex = ref(0);

// Reported once the scroll has rested, not on every frame: it ends up in the
// URL, and browsers throttle history updates.
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const settleSoon = () => {
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    if (!props.open || !current.value) return;
    settledIndex.value = index.value;
    emit("settle", current.value.id);
  }, 150);
};

// PROF-73: clips play with sound; muting holds for the next clip too, as it
// does in any feed, until the viewer closes.
const muted = ref(false);
const flash = ref(0);
let flashTimer: ReturnType<typeof setTimeout> | undefined;
const toggleMute = () => {
  muted.value = !muted.value;
  clearTimeout(flashTimer);
  flash.value++;
  flashTimer = setTimeout(() => (flash.value = 0), 700);
};

// Closing drops a pending report, so it can't put ?media back afterwards.
const close = () => {
  clearTimeout(settleTimer);
  emit("close");
};

// Set before the feed renders, so only the tapped item and its neighbours
// start loading.
watch(
  () => props.open,
  (open) => {
    if (!open) return clearTimeout(settleTimer);
    const start = props.items.findIndex((item) => item.id === props.startId);
    // A link to an item that's gone: nothing to show.
    if (start === -1) return close();
    index.value = settledIndex.value = start;
    muted.value = false;
  },
  { immediate: true }
);

// The feed mounts afresh each time the viewer opens: jump straight to the
// tapped item before anything paints, so no other photo flashes past.
watch(
  scroller,
  (el) => {
    if (!el) return;
    el.scrollTop = index.value * el.clientHeight;
    el.focus({ preventScroll: true });
  },
  { flush: "post" }
);

const onScroll = () => {
  const el = scroller.value;
  if (!el?.clientHeight) return;
  const nearest = Math.round(el.scrollTop / el.clientHeight);
  index.value = Math.min(Math.max(nearest, 0), props.items.length - 1);
  settleSoon();
};

// After a delete the list comes back shorter. The feed keeps its scroll
// offset, so the next item has moved up into view; the last one gone means
// the one before it, and nothing left means there's nothing to view.
watch(
  () => props.items,
  (items) => {
    if (!scroller.value) return;
    if (!items.length) return close();
    index.value = Math.min(index.value, items.length - 1);
    settleSoon();
  }
);

const guardEdges = (event: TouchEvent) => {
  const touch = event.touches[0];
  if (touch && !backSwipeCanStart(touch.clientX)) event.stopPropagation();
};

onBeforeUnmount(() => {
  clearTimeout(settleTimer);
  clearTimeout(flashTimer);
});
</script>
