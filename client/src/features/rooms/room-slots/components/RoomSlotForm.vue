<template>
  <form.Field v-slot="{ field }" name="price">
    <FieldWrapper block-label="Price">
      <InputText
        :model-value="field.state.value"
        type="text"
        fluid
        placeholder="e.g. 12.00"
        :disabled="disabled"
        @update:model-value="field.handleChange"
      />
    </FieldWrapper>
  </form.Field>

  <form.Field v-slot="{ field }" name="features">
    <FieldWrapper block-label="Features" class="flex-1 flex flex-col">
      <div
        class="flex flex-wrap !gap-2 rounded-xl border border-surface-200 bg-surface-50/50 !p-3"
      >
        <Button
          v-for="feature in AVAILABLE_FEATURES"
          :key="feature.label"
          :label="feature.label"
          :icon="`fa-solid ${feature.icon}`"
          size="small"
          rounded
          class="!cursor-pointer"
          :disabled="disabled"
          :variant="
            field.state.value.includes(feature.label) ? 'filled' : 'outlined'
          "
          @click="
            field.handleChange(toggleInArray(field.state.value, feature.label))
          "
        />
      </div>
    </FieldWrapper>
  </form.Field>

  <form.Field v-slot="{ field }" name="max_players">
    <FieldWrapper block-label="Max players">
      <InputNumber
        :model-value="field.state.value"
        class="w-full"
        :min="0"
        :show-buttons="true"
        button-layout="horizontal"
        decrement-button-icon="fa-solid fa-minus"
        increment-button-icon="fa-solid fa-plus"
        :disabled="disabled"
        @update:model-value="field.handleChange"
      />
    </FieldWrapper>
  </form.Field>

  <form.Field v-slot="{ field }" name="message">
    <FieldWrapper block-label="Message">
      <Textarea
        :model-value="field.state.value"
        rows="2"
        cols="30"
        fluid
        placeholder="Any message for players…"
        :disabled="disabled"
        @update:model-value="field.handleChange"
      />
    </FieldWrapper>
  </form.Field>

  <FieldWrapper v-if="showEnabledToggle" block-label="Launch to players">
    <ToggleSwitch v-model="enabledModel" input-id="enabled" />
  </FieldWrapper>
</template>

<script setup lang="ts">
import {
  InputNumber,
  InputText,
  Textarea,
  Button,
  ToggleSwitch,
} from "primevue";
import FieldWrapper from "./FieldWrapper.vue";

const AVAILABLE_FEATURES = [
  { label: "ball", icon: "fa-futbol" },
  { label: "showers", icon: "fa-shower" },
  { label: "parking", icon: "fa-square-parking" },
  { label: "lights", icon: "fa-sun" },
];

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  showEnabledToggle?: boolean;
  disabled?: boolean;
}>();

const enabledModel = defineModel<boolean>("enabled", { required: true });

const toggleInArray = (arr: string[], item: string) =>
  arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item].sort();
</script>
