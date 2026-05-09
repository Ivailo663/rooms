<template>
  <div class="flex flex-col">
    <div class="flex justify-between items-center gap-2 !mb-2">
      <label for="price">{{ props.blockLabel }}</label>

      <div v-if="props.checkbox">
        <label for="ingredient1" class="!mr-2"> Apply to all slots </label>
        <Checkbox inputId="ingredient1" name="pizza" value="Cheese" />
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
