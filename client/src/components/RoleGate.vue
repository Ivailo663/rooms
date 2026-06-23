<script setup lang="ts">
import { computed } from "vue";
import { useRoleStore, type Capability } from "@/stores/role";

const props = defineProps<{
  capability: Capability;
}>();

const roleStore = useRoleStore();
const allowed = computed(() => roleStore.can(props.capability));
</script>

<template>
  <slot v-if="allowed" />
  <slot v-else name="fallback" />
</template>
