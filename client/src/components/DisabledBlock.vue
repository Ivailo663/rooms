<template>
  <div
    :class="props.disabled && 'opacity-40 pointer-events-none select-none'"
    :aria-disabled="props.disabled || undefined"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ disabled?: boolean }>(), {
  disabled: false,
});
</script>
