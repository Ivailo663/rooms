<template>
  <div class="flex flex-col !gap-2">
    <label class="text-[11px] font-medium tracking-wide text-surface-400/80">
      {{ props.blockLabel }}
    </label>

    <slot />
  </div>
</template>

<script lang="ts" setup>
interface Props {
  blockLabel: string;
}

const props = defineProps<Props>();
</script>
