<template>
  <div class="flex flex-col !gap-1.5">
    <div class="flex items-center justify-between">
      <label
        class="text-xs font-semibold uppercase tracking-widest text-surface-400"
      >
        {{ props.blockLabel }}
      </label>

      <div v-if="props.checkbox" class="flex items-center !gap-2">
        <label for="ingredient1" class="text-xs text-surface-400">
          Apply to all slots
        </label>
        <Checkbox input-id="ingredient1" name="pizza" value="Cheese" />
      </div>
    </div>

    <slot />
  </div>
</template>

<script lang="ts" setup>
import { Checkbox } from "primevue";

interface Props {
  blockLabel: string;
  checkbox?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  checkbox: true,
});
</script>
