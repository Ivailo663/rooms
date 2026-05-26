<template>
  <div :class="['rounded-xl border border-surface-200 bg-white !p-5', props.class]">
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  class?: string
}>()
</script>
