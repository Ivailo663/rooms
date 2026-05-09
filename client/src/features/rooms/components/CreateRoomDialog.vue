<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    header="Create room"
    :style="{ width: '25rem' }"
  >
    <span class="text-surface-500 dark:text-surface-400 block mb-8!">
      Update your information.
    </span>

    <div class="flex items-center gap-4 mb-4!">
      <label for="room-name" class="font-semibold w-24">name</label>
      <InputText
        id="room-name"
        v-model="name"
        class="flex-auto"
        autocomplete="off"
      />
    </div>

    <div class="flex items-center gap-4 mb-4!">
      <label for="room-description" class="font-semibold w-24">
        description
      </label>
      <Textarea
        id="room-description"
        v-model="description"
        class="flex-auto"
        autocomplete="off"
      />
    </div>

    <div>
      <label for="room-day">Day</label>

      <DatePicker v-model="day" showIcon fluid :showOnFocus="false" />
    </div>

    <div class="flex justify-end gap-2">
      <Button
        type="button"
        label="Cancel"
        severity="secondary"
        @click="handleCancel"
      />
      <Button type="button" label="Save" @click="handleSave" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Button,
  InputText,
  Textarea,
  Dialog,
  Select,
  DatePicker,
} from "primevue";

type CreateRoomPayload = {
  name: string;
  description: string;
};

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "save", payload: CreateRoomPayload): void;
}>();

const name = ref("");
const description = ref("");
const day = ref(new Date());

const localVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit("update:visible", value),
});

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      name.value = "";
      description.value = "";
    }
  },
);

const handleCancel = () => {
  localVisible.value = false;
};

const handleSave = () => {
  emit("save", {
    name: name.value,
    description: description.value,
  });
};
</script>
