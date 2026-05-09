<template>
  <FieldWrapper blockLabel="Price">
    <InputText type="text" id="price" fluid v-model="model.price" />
  </FieldWrapper>

  <FieldWrapper blockLabel="Features" class="flex-1 flex flex-col">
    <Card class="!h-full">
      <template #content>
        <Chip
          v-for="feature in features"
          :key="feature"
          class="!mx-2"
          :label="feature"
        />
      </template>
    </Card>
  </FieldWrapper>

  <FieldWrapper blockLabel="Max players">
    <InputNumber
      id="max_players"
      class="w-full"
      v-model="model.max_players"
      :min="0"
    />
  </FieldWrapper>

  <FieldWrapper blockLabel="Message">
    <Textarea rows="5" cols="30" fluid v-model="model.message" />
  </FieldWrapper>
</template>

<script setup lang="ts">
import { Card, InputNumber, InputText, Textarea, Chip } from "primevue";
import FieldWrapper from "./FieldWrapper.vue";
import type { TimeslotResponse } from "@football/shared";

const model = defineModel<{
  price: string | null;
  message: TimeslotResponse["message"];
  max_players: number | null;
}>({ required: true });

defineProps<{
  features: string[];
}>();
</script>
