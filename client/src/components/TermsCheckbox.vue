<template>
  <div class="flex items-start !gap-3">
    <Checkbox v-model="ticked" binary :input-id="inputId" class="!mt-0.5" />
    <label
      :for="inputId"
      class="cursor-pointer text-sm leading-snug text-surface-700"
    >
      {{ TERMS_TEXT }}
    </label>
  </div>
</template>

<script setup lang="ts">
import { Checkbox } from "primevue";

// AUTH-20: the exact words, in one place, so the sign-up form and the terms
// screen can never drift apart.
const TERMS_TEXT = "I'm 18 or over, and other players can rate me after games.";

defineProps<{ inputId: string }>();

const ticked = defineModel<boolean>({ required: true });
</script>
