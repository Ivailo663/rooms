<template>
  <div class="flex !gap-6 items-start">
    <div ref="formRef" class="flex-1">
      <!-- Day selector -->
      <div
        class="w-full flex justify-between items-end text-primary uppercase rounded-[10px] !p-3 !mb-5 text-right border border-primary-100 day-banner"
      >
        <div>
          <p
            class="!mb-2 flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
          >
            <i class="fa-solid fa-calendar" style="font-size: 0.6rem" />
            Day
          </p>
          <SelectButton
            v-model="weekDay"
            :options="DAYS"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            @change="isCreating = false"
          >
            <template #option="{ option }">
              <span>
                {{ option.label }}
                <span
                  v-if="option.value === todayValue"
                  class="h-2 w-2 rounded-full bg-primary absolute top-[5px] right-[5px]"
                />
              </span>
            </template>
          </SelectButton>
        </div>
        <p class="text-[25px] !font-thin tracking-[5px]">
          {{ DAYS.find((d) => d.value === weekDay)?.full }}
        </p>
      </div>

      <!-- Slot picker -->
      <BasicWrapper class="!mb-5">
        <div class="flex items-start justify-between !gap-4">
          <div class="flex-1">
            <p
              class="!mb-3 flex items-center !gap-1.5 text-xs font-semibold uppercase tracking-widest text-surface-400"
            >
              <i class="fa-solid fa-clock" style="font-size: 0.6rem" />
              Time slots
            </p>
            <div class="flex flex-wrap !gap-2">
              <Button
                v-for="(slot, index) in slots"
                :key="slot.id"
                :label="slot.label"
                size="small"
                icon="fa-solid fa-clock"
                class="!cursor-pointer"
                :variant="
                  index === selectedIndex && !isCreating ? 'filled' : 'outlined'
                "
                @click="selectSlot(index)"
              />
            </div>
            <p
              v-if="!slots?.length"
              class="!mt-1 text-xs italic text-surface-300"
            >
              No slots for this day yet
            </p>
          </div>

          <div class="shrink-0">
            <p
              class="!mb-2 text-xs font-semibold uppercase tracking-widest text-surface-400"
            >
              Add slot
            </p>
            <Select
              v-model="newTimeslot"
              :options="TIME_OPTIONS"
              option-label="name"
              placeholder="Select time…"
              show-clear
              @change="isCreating = !!newTimeslot"
            />
          </div>
        </div>
      </BasicWrapper>

      <!-- Form card -->
      <BasicWrapper class="flex flex-col !gap-5">
        <template v-if="slots?.length || isCreating">
          <!-- Launch / Stop -->

          <RoomFormSlot
            v-model:enabled="enabled"
            :form="form"
            :show-enabled-toggle="isCreating"
            :disabled="!isCreating && enabled"
          />

          <Button
            v-if="!isCreating && selectedSlot"
            :label="enabled ? 'Stop slot' : 'Launch slot'"
            :icon="enabled ? 'fa-solid fa-stop' : 'fa-solid fa-play'"
            :severity="enabled ? 'danger' : 'success'"
            size="large"
            class="w-full"
            @click="toggleLaunch"
          />

          <!-- Creating actions -->
          <div
            v-if="isCreating"
            class="flex justify-end !gap-2 border-t border-surface-100 !pt-3"
          >
            <Button
              label="Discard"
              severity="secondary"
              outlined
              icon="fa-solid fa-xmark"
              size="small"
              @click="discardNewSlot"
            />
            <Button
              label="Save slot"
              severity="success"
              icon="fa-solid fa-check"
              size="small"
              :disabled="!newTimeslot"
              @click="form.handleSubmit()"
            />
          </div>

          <!-- Edit actions -->
          <div
            v-else-if="selectedSlot"
            class="flex items-center justify-between border-t border-surface-100 !pt-3"
          >
            <Button
              :label="`Delete ${selectedSlot.label}`"
              severity="danger"
              size="small"
              variant="text"
              icon="fa-solid fa-trash"
              @click="deleteSlot"
            />
            <div v-if="isDirty" class="flex !gap-2">
              <Button
                label="Discard"
                severity="secondary"
                outlined
                icon="fa-solid fa-rotate"
                size="small"
                @click="form.reset()"
              />
              <Button
                label="Save"
                severity="success"
                icon="fa-solid fa-check"
                size="small"
                @click="form.handleSubmit()"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex flex-col items-center !py-10 text-center">
            <div
              class="!mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100"
            >
              <i class="fa-solid fa-clock text-xl text-surface-300" />
            </div>
            <p class="!mb-1 text-sm font-medium text-surface-500">
              No time slots yet
            </p>
            <p class="!mb-4 text-xs text-surface-300">
              Add your first time slot for this day
            </p>
            <Button
              label="Create a slot"
              icon="fa-solid fa-plus"
              variant="text"
              size="small"
              @click="isCreating = true"
            />
          </div>
        </template>
      </BasicWrapper>
    </div>

    <ActiveSlotsPanel
      :room-id="id"
      :selected-day="weekDay"
      :max-height="formHeight"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { Button, Select, SelectButton } from "primevue";
import { refDebounced } from "@vueuse/core";
import { useAfterPaint } from "@/composables/useAfterPain";
import { useForm } from "@tanstack/vue-form";
import type { TimeslotResponse } from "@football/shared";
import {
  useGetTimeslots,
  useCreateTimeslot,
  useUpdateTimeslot,
  useDeleteTimeslot,
} from "../../composables/queries";
import RoomFormSlot from "./RoomSlotForm.vue";
import ActiveSlotsPanel from "./ActiveSlotsPanel.vue";

const props = defineProps<{ id: number }>();

const formRef = ref<HTMLElement | null>(null);
const formHeight = ref<number | null>(null);

useAfterPaint(() => {
  formHeight.value = formRef.value?.offsetHeight ?? null;
});

const DAYS = [
  { label: "Mo", value: "mo", full: "Monday" },
  { label: "Tu", value: "tu", full: "Tuesday" },
  { label: "We", value: "we", full: "Wednesday" },
  { label: "Th", value: "th", full: "Thursday" },
  { label: "Fr", value: "fr", full: "Friday" },
  { label: "Sa", value: "sa", full: "Saturday" },
  { label: "Su", value: "su", full: "Sunday" },
];

const TIME_OPTIONS = Array.from({ length: 25 }, (_, h) => {
  const t = `${String(h).padStart(2, "0")}:00`;
  return { name: t, code: t, order: h };
});

const EMPTY_FORM = {
  price: null as string | null,
  message: null as string | null,
  max_players: null as number | null,
  features: [] as string[],
};

const slotToForm = (slot: TimeslotResponse): typeof EMPTY_FORM => ({
  price: slot.price !== null ? String(slot.price) : null,
  message: slot.message ?? null,
  max_players: slot.max_players ?? null,
  features: Array.isArray(slot.features)
    ? [...(slot.features as string[])].sort()
    : [],
});

const todayValue =
  DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]?.value;

const weekDay = ref(todayValue as string);
const debouncedWeekDay = refDebounced(weekDay, 300);

const { data: slots } = useGetTimeslots({
  room_id: props.id,
  day: debouncedWeekDay,
});

const createMutation = useCreateTimeslot();
const updateMutation = useUpdateTimeslot();
const deleteMutation = useDeleteTimeslot();

const selectedIndex = ref(0);
const isCreating = ref(false);
const newTimeslot = ref<{ name: string; code: string; order: number } | null>(
  null
);
const enabled = ref(false);

const selectedSlot = computed(() => slots.value?.[selectedIndex.value]);

const form = useForm({
  defaultValues: { ...EMPTY_FORM },
  onSubmit: async ({ value }) => {
    if (isCreating.value && newTimeslot.value) {
      await createMutation.mutateAsync({
        room_id: props.id,
        order: newTimeslot.value.order,
        day: weekDay.value,
        name: newTimeslot.value.name,
        label: newTimeslot.value.code,
        max_players: value.max_players ?? 0,
        price: value.price,
        message: value.message,
        features: value.features,
        enabled: enabled.value,
      });
      discardNewSlot();
    } else if (selectedSlot.value) {
      await updateMutation.mutateAsync({
        id: selectedSlot.value.id,
        max_players: value.max_players ?? 0,
        price: value.price,
        message: value.message,
        features: value.features,
      });
      form.reset(value);
    }
  },
});

const isDirty = form.useStore((s) => s.isDirty);

watch(slots, (next) => {
  if (!next?.length) selectedIndex.value = 0;
  else if (selectedIndex.value >= next.length)
    selectedIndex.value = next.length - 1;
});

watch(
  [() => selectedSlot.value?.id, isCreating],
  ([, creating]) => {
    if (creating || !selectedSlot.value) {
      form.reset({ ...EMPTY_FORM });
      if (creating) enabled.value = false;
    } else {
      form.reset(slotToForm(selectedSlot.value));
      enabled.value = selectedSlot.value.enabled ?? false;
    }
  },
  { immediate: true }
);

const selectSlot = (index: number) => {
  selectedIndex.value = index;
  isCreating.value = false;
  newTimeslot.value = null;
};

const discardNewSlot = () => {
  isCreating.value = false;
  newTimeslot.value = null;
  if (slots.value?.length) selectedIndex.value = 0;
};

const toggleLaunch = () => {
  if (!selectedSlot.value) return;
  enabled.value = !enabled.value;
  updateMutation.mutate({ id: selectedSlot.value.id, enabled: enabled.value });
};

const deleteSlot = async () => {
  if (!selectedSlot.value) return;
  try {
    await deleteMutation.mutateAsync(selectedSlot.value.id);
    selectedIndex.value = Math.max(0, selectedIndex.value - 1);
  } catch (error) {
    console.error("Failed to delete timeslot:", error);
  }
};
</script>

<style>
.day-banner {
  background-image: linear-gradient(to right, #ccc9ff, #fefeff);
}
</style>
