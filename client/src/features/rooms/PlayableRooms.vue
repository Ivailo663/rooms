<template>
  <PRoomCards />
</template>

<script lang="ts" setup>
import PRoomCards from "./components/PRoomCards.vue";

defineProps<{ search: string }>();
</script>
