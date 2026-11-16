<template>
  <!-- `contents`, so the confirm covers whatever positioned box holds this:
       the tile in the grid, the whole screen in the viewer. -->
  <div ref="root" class="contents">
    <!-- PROF-74. Always visible: a phone has no hover to reveal it. The
         button is bigger than its circle so the photo stays the point. -->
    <button
      v-if="!confirming"
      type="button"
      class="absolute flex items-center justify-center"
      :class="
        size === 'viewer'
          ? 'right-2 top-[max(0.5rem,env(safe-area-inset-top))] h-12 w-12'
          : 'right-0 top-0 h-10 w-10'
      "
      aria-label="Delete photo"
      data-delete-media
      @click="confirming = true"
    >
      <span
        class="flex items-center justify-center rounded-full text-white"
        :class="
          size === 'viewer' ? 'h-10 w-10 bg-white/15' : 'h-7 w-7 bg-black/45'
        "
      >
        <i
          class="fa-solid fa-trash-can"
          :class="size === 'viewer' ? 'text-sm' : 'text-[11px]'"
          aria-hidden="true"
        />
      </span>
    </button>

    <!-- Escape backs out of the confirm only; in the viewer it mustn't reach
         the dialog and close everything. -->
    <div
      v-else
      role="group"
      aria-label="Delete this photo?"
      class="absolute inset-0 flex flex-col items-center justify-center !gap-1.5 bg-black/65 !p-2 text-center"
      data-confirm-delete
      @keydown.escape.stop="confirming = false"
    >
      <p v-if="isError" role="alert" class="text-xs text-white">
        Couldn't delete. Try again.
      </p>
      <Button
        label="Delete"
        severity="danger"
        :size="buttonSize"
        :loading="isPending"
        data-confirm
        @click="confirm"
      />
      <Button
        label="Keep"
        :size="buttonSize"
        text
        class="!text-white"
        :disabled="isPending"
        data-keep
        @click="confirming = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import { Button } from "primevue";
import type { MediaItem } from "@football/shared";
import { useDeleteMedia } from "../composables/queries";

const props = withDefaults(
  defineProps<{
    item: MediaItem;
    playerId: number;
    size?: "tile" | "viewer";
  }>(),
  { size: "tile" }
);

const buttonSize = computed(() =>
  props.size === "viewer" ? undefined : "small"
);

const root = useTemplateRef<HTMLElement>("root");
const confirming = ref(false);
// The safe choice takes focus, so a stray Enter doesn't delete; backing out
// hands focus back to the delete button rather than dropping it on the page.
watch(confirming, async (open) => {
  await nextTick();
  root.value
    ?.querySelector<HTMLElement>(open ? "[data-keep]" : "[data-delete-media]")
    ?.focus();
});

const { mutate, isPending, isError } = useDeleteMedia(() => props.playerId);

// In the viewer this control outlives the item: once the list has come back
// without it, the next item's delete button is the one showing.
const confirm = () =>
  mutate(props.item.id, { onSuccess: () => (confirming.value = false) });
</script>
