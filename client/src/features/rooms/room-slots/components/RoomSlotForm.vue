<template>
  <div
    v-if="disabled"
    class="flex items-start !gap-2.5 rounded-lg border border-surface-200 bg-surface-50 !px-3 !py-2.5"
  >
    <i
      class="fa-solid fa-lock !mt-0.5 text-surface-400"
      style="font-size: 0.7rem"
    />
    <p class="text-[11px] leading-relaxed text-surface-500">
      <span class="font-semibold text-surface-600">Slot is live.</span>
      Stop it to edit settings.
    </p>
  </div>

  <form.Field v-if="availableHours" v-slot="{ field }" name="label">
    <FieldWrapper block-label="Hour">
      <div class="flex overflow-x-auto !gap-1 pb-0.5" style="scrollbar-width: none">
        <button
          v-for="opt in availableHours"
          :key="opt.code"
          type="button"
          :disabled="disabled"
          :class="[
            'shrink-0 rounded-md !px-2.5 !py-1.5 text-center text-xs font-medium transition-colors border',
            field.state.value === opt.code
              ? 'bg-primary-600 text-white border-primary-600'
              : 'text-surface-500 border-surface-200 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-300',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          ]"
          @click="field.handleChange(opt.code)"
        >
          {{ opt.name }}
        </button>
      </div>
    </FieldWrapper>
  </form.Field>

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
      <div class="flex flex-wrap !gap-1.5">
        <Button
          v-for="feature in featureChips"
          :key="feature.label"
          :label="feature.label"
          :icon="`fa-solid ${feature.icon}`"
          size="small"
          rounded
          class="!cursor-pointer feature-chip"
          :class="{
            'feature-chip--active': field.state.value.includes(feature.label),
          }"
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

  <div class="flex !gap-4">
    <form.Field v-slot="{ field }" name="min_players">
      <FieldWrapper block-label="Min players" class="flex-1 min-w-0">
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

    <form.Field v-slot="{ field }" name="max_players">
      <FieldWrapper block-label="Max players" class="flex-1 min-w-0">
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
  </div>

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
import { computed } from "vue";
import {
  InputNumber,
  InputText,
  Textarea,
  Button,
  ToggleSwitch,
} from "primevue";
import FieldWrapper from "./FieldWrapper.vue";

const BUILTIN_FEATURES: Record<string, string> = {
  ball: "fa-futbol",
  showers: "fa-shower",
  parking: "fa-square-parking",
  lights: "fa-sun",
};

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  availableFeatures?: string[];
  availableHours?: { name: string; code: string; order: number }[];
  showEnabledToggle?: boolean;
  disabled?: boolean;
}>();

const featureChips = computed(() => {
  const labels = props.availableFeatures ?? Object.keys(BUILTIN_FEATURES);
  return labels.map((label) => ({
    label,
    icon: BUILTIN_FEATURES[label] ?? "fa-tag",
  }));
});

const enabledModel = defineModel<boolean>("enabled", { required: true });

const toggleInArray = (arr: string[], item: string) =>
  arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item].sort();
</script>

<style scoped>
.feature-chip {
  font-size: 0.75rem !important;
  transition: all 0.2s ease;
}
.feature-chip:not(.feature-chip--active) {
  opacity: 0.55;
}
.feature-chip:not(.feature-chip--active):hover {
  opacity: 0.85;
}

:deep(.p-inputtext:not(.p-inputnumber-input)),
:deep(.p-textarea) {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  border-color: var(--p-surface-200);
  border-radius: 0.625rem;
}
:deep(.p-inputtext:not(.p-inputnumber-input):not(:focus)),
:deep(.p-textarea:not(:focus)) {
  background: var(--p-surface-50);
}

:deep(.p-inputnumber) {
  min-width: 0;
}
:deep(.p-inputnumber .p-inputnumber-input) {
  min-width: 0;
  width: 100%;
}
</style>
