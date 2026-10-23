<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    :style="{ width: '26rem' }"
    :pt="{ header: { class: 'border-b border-surface-100 !pb-4' } }"
  >
    <template #header>
      <div class="flex items-center !gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50"
        >
          <i
            class="fa-solid fa-grip text-primary-500"
            style="font-size: 0.9rem"
          />
        </div>
        <div>
          <h2 class="text-base font-bold text-surface-900">Create room</h2>
          <p class="text-xs text-surface-400">
            Add a new room to your portfolio
          </p>
        </div>
      </div>
    </template>

    <div class="flex flex-col !gap-5 !py-5">
      <div class="flex flex-col !gap-1.5">
        <label
          class="flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
        >
          <i class="fa-solid fa-tag" style="font-size: 0.6rem" />
          Room name
        </label>
        <InputText
          id="room-name"
          v-model="name"
          placeholder="e.g. City Arena"
          class="w-full"
          autocomplete="off"
        />
      </div>

      <div class="flex flex-col !gap-1.5">
        <label
          class="flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
        >
          <i class="fa-solid fa-euro-sign" style="font-size: 0.6rem" />
          Price
        </label>
        <InputNumber
          id="room-price"
          v-model="price"
          placeholder="Set a price"
          class="w-full"
          rows="3"
          autocomplete="off"
        />
      </div>

      <div class="flex flex-col !gap-1.5">
        <label
          class="flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
        >
          <i class="fa-solid fa-bars" style="font-size: 0.6rem" />
          Description
        </label>
        <Textarea
          id="room-description"
          v-model="description"
          placeholder="Tell players about your room…"
          class="w-full"
          rows="3"
          autocomplete="off"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end !gap-2 border-t border-surface-100 !pt-4">
        <Button
          label="Cancel"
          severity="secondary"
          outlined
          icon="fa-solid fa-xmark"
          @click="handleCancel"
        />
        <Button label="Create room" icon="fa-solid fa-check" @click="handleSave" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, InputText, InputNumber, Textarea, Dialog } from "primevue";

type CreateRoomPayload = {
  name: string;
  description: string;
  price: number;
};

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "save", payload: CreateRoomPayload): void;
}>();

const name = ref("");
const price = ref(0);
const description = ref("");

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
  }
);

const handleCancel = () => {
  localVisible.value = false;
};

const handleSave = () => {
  emit("save", {
    name: name.value,
    description: description.value,
    price: price.value,
  });
};
</script>
