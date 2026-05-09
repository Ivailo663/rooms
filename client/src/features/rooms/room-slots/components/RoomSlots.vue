<template>
  <div class="flex gap-5">
    <div class="flex-1">
      <div class="flex justify-between !mb-5">
        <SelectButton
          v-model="weekDay"
          @change="isFormVisible = false"
          :options="days"
          optionLabel="label"
          optionValue="value"
        />

        <Button
          v-if="slotMode.mode === 'view' && dataSlots?.length"
          :label="`Delete slot ${selectedSlot?.label}`"
          severity="danger"
          size="small"
          variant="text"
          @click="handleDeleteSlot"
        />

        <div
          v-if="slotMode.mode === 'create'"
          class="flex gap-2 w-full justify-end"
        >
          <Button
            label="Save"
            severity="success"
            class="px-4"
            @click="handleSaveNewSlot"
          />
          <Button
            label="Discard"
            severity="secondary"
            outlined
            class="px-4"
            @click="handleDiscardNewSlot"
          />
        </div>
      </div>
      <div class="flex-1">
        <Card
          class="!mb-5"
          :pt="{
            content: { class: 'flex justify-between' },
          }"
        >
          <template #content>
            <div class="flex gap-3">
              <Button
                class="!cursor-pointer"
                v-for="(slot, index) in dataSlots"
                :key="slot.id"
                :label="slot.label"
                :variant="
                  selectedSlotIndex === index && !isCreatingMode
                    ? 'filled'
                    : 'outlined'
                "
                @click="handleSelectSlot(index as number)"
              />
            </div>

            <Select
              v-model="timeslot"
              :options="timeslotOptions"
              optionLabel="name"
              placeholder="Select timeslot"
              showClear
              @change="handleCreateNew"
            />
          </template>
        </Card>

        <Card
          class="flex flex-col flex-1 gap-5"
          :pt="{
            content: { class: 'flex flex-col gap-6' },
          }"
        >
          <template v-if="dataSlots?.length || isFormVisible" #content>
            <RoomFormSlot v-model="form" :features="slotMode.features" />
          </template>

          <template v-else #content>
            <div class="flex flex-col items-center w-full !my-10">
              <p class="!mb-2">No timeslots available.</p>
              <Button variant="text" @click="isFormVisible = true">
                Create a slot
              </Button>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <Card class="border w-[15%] h-auto">
      <template #content>
        <p>Active slots will appear here.</p>
      </template>
    </Card>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { Card, Button, Select, SelectButton } from "primevue";
import FieldWrapper from "./FieldWrapper.vue";
import {
  useGetTimeslots,
  useCreateTimeslot,
  useDeleteTimeslot,
} from "../../composables/queries";
import type { TimeslotResponse } from "@football/shared";
import RoomFormSlot from "./RoomSlotForm.vue";

interface Props {
  id: number;
}

const days = [
  { label: "Mo", value: "mo" },
  { label: "Tu", value: "tu" },
  { label: "We", value: "we" },
  { label: "Th", value: "th" },
  { label: "Fr", value: "fr" },
  { label: "Sa", value: "sa" },
  { label: "Su", value: "su" },
];

const weekDay = ref<string>("mo");
const props = defineProps<Props>();
const { data: dataSlots } = useGetTimeslots({
  room_id: props.id,
  day: weekDay,
});

const createTimeslotMutation = useCreateTimeslot();
const deleteTimeslotMutation = useDeleteTimeslot();

const selectedSlotIndex = ref<number | null>(0);
const isCreatingMode = ref(false);
const isFormVisible = ref(false);

const selectedSlot = computed(() => {
  if (selectedSlotIndex.value === null) return undefined;
  return dataSlots.value?.[selectedSlotIndex.value];
});

// Single object to gateway all slot reads
const slotMode = computed(() => {
  if (isCreatingMode.value) {
    return {
      mode: "create" as const,
      slot: null,
      features: [] as string[],
      players: [],
      max_players: null,
    };
  }

  return {
    mode: "view" as const,
    slot: selectedSlot.value ?? null,
    features: Array.isArray(selectedSlot.value?.features)
      ? selectedSlot.value.features
      : [],
    players: selectedSlot.value?.players ?? [],
    max_players: selectedSlot.value?.max_players ?? null,
  };
});

const timeslot = ref();
const timeslotOptions = ref([
  { name: "00:00", code: "00:00" },
  { name: "01:00", code: "01:00" },
  { name: "02:00", code: "02:00" },
  { name: "03:00", code: "03:00" },
  { name: "04:00", code: "04:00" },
  { name: "05:00", code: "05:00" },
  { name: "06:00", code: "06:00" },
  { name: "07:00", code: "07:00" },
  { name: "08:00", code: "08:00" },
  { name: "09:00", code: "09:00" },
  { name: "10:00", code: "10:00" },
  { name: "11:00", code: "11:00" },
  { name: "12:00", code: "12:00" },
  { name: "13:00", code: "13:00" },
  { name: "14:00", code: "14:00" },
  { name: "15:00", code: "15:00" },
  { name: "16:00", code: "16:00" },
  { name: "17:00", code: "17:00" },
  { name: "18:00", code: "18:00" },
  { name: "19:00", code: "19:00" },
  { name: "20:00", code: "20:00" },
  { name: "21:00", code: "21:00" },
  { name: "22:00", code: "22:00" },
  { name: "23:00", code: "23:00" },
  { name: "24:00", code: "24:00" },
]);

const form = ref<{
  price: string | null;
  message: TimeslotResponse["message"];
  max_players: number | null;
}>({
  price: null,
  message: null,
  max_players: null,
});

watch(
  () => slotMode.value,
  (mode) => {
    if (mode.mode === "create") {
      form.value = { price: null, message: null, max_players: null };
    } else {
      form.value.price =
        mode.slot?.price != null ? String(mode.slot.price) : null;
      form.value.message = mode.slot?.message ?? null;
      form.value.max_players = mode.slot?.max_players ?? null;
    }
  },
  { immediate: true, deep: true },
);

const handleSelectSlot = (index: number) => {
  selectedSlotIndex.value = index;
  timeslot.value = null;
  isCreatingMode.value = false;
};

const handleCreateNew = () => {
  selectedSlotIndex.value = null;
  isCreatingMode.value = true;
};

const handleDiscardNewSlot = () => {
  if (dataSlots.value?.length) {
    handleSelectSlot(0);
  } else {
    selectedSlotIndex.value = null;
    isCreatingMode.value = false;
  }
};

const handleSaveNewSlot = async () => {
  if (!timeslot.value) return;

  try {
    await createTimeslotMutation.mutateAsync({
      room_id: props.id,
      day: weekDay.value, // Join selected days into a comma-separated string
      name: timeslot.value.name,
      label: timeslot.value.code,
      available_date: new Date().toISOString().split("T")[0], // Today's date
      max_players: form.value.max_players ?? 0,
      price: form.value.price,
      message: form.value.message,
      features: [], // Empty for now
    });

    // After successful creation, switch to view mode
    if (dataSlots.value?.length) {
      handleSelectSlot(0);
    } else {
      selectedSlotIndex.value = null;
      isCreatingMode.value = false;
    }
  } catch (error) {
    console.error("Failed to create timeslot:", error);
    // TODO: show error message
  }
};

const handleDeleteSlot = async () => {
  if (!slotMode.value.slot) return;

  try {
    await deleteTimeslotMutation.mutateAsync(slotMode.value.slot.id);

    // After deletion, select another slot or go to create mode
    if (dataSlots.value && dataSlots.value.length > 1) {
      const currentIndex = selectedSlotIndex.value;
      if (currentIndex !== null && currentIndex > 0) {
        handleSelectSlot(currentIndex - 1);
      } else {
        handleSelectSlot(0);
      }
    } else {
      selectedSlotIndex.value = null;
      isCreatingMode.value = false;
    }
  } catch (error) {
    console.error("Failed to delete timeslot:", error);
    // TODO: show error message
  }
};
</script>
